import { OPENROUTER_API_KEY } from '$app/env/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Trip } from '#lib/types.js';
import { getSessionFromCookies } from '#lib/server/auth.js';
import { getAccessibleTripById } from '#lib/server/trip-access.js';
import { getTripItems } from '#lib/server/trip-enrichment.js';
import { getTripInsightSummary } from '#lib/packing-insights.js';
import { buildSystemPrompt } from '#lib/server/ai-prompt.js';
import { getStripeMode, isStripeConfigured } from '#lib/server/stripe.js';
import {
	recordGeneration,
	releaseUsage,
	reserveUsage,
	settleUsage
} from '#lib/server/billing-wallet.js';
import { parseProviderUsage, reconcileUsage } from '#lib/server/billing-usage.js';

const MAX_BODY_BYTES = 65_536;
const MAX_PROMPT_BYTES = 16_384;
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface Message {
	role: 'user' | 'assistant';
	content: string;
}

async function readBody(request: Request): Promise<unknown> {
	const reader = request.body?.getReader();
	if (!reader) throw new Error('Missing body');
	const decoder = new TextDecoder();
	let size = 0;
	let text = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > MAX_BODY_BYTES) {
			await reader.cancel();
			throw new Error('Body too large');
		}
		text += decoder.decode(value, { stream: true });
	}
	return JSON.parse(text + decoder.decode());
}

function validMessages(value: unknown): value is Message[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.length <= 30 &&
		value.every(
			(message) =>
				message &&
				(message.role === 'user' || message.role === 'assistant') &&
				typeof message.content === 'string' &&
				message.content.trim().length > 0
		) &&
		value.at(-1).role === 'user'
	);
}

export const POST: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Sign in to use AI.' }, { status: 401 });
	const userId = session.userId;
	if (event.request.headers.get('origin') !== event.url.origin) {
		return json({ error: 'Invalid request origin.' }, { status: 403 });
	}
	const testMode = getStripeMode() === 'test';
	if (!isStripeConfigured() || (!testMode && !OPENROUTER_API_KEY)) {
		return json({ error: 'AI is temporarily unavailable.' }, { status: 503 });
	}
	let body;
	try {
		body = await readBody(event.request);
	} catch {
		return json({ error: 'Invalid or oversized chat request.' }, { status: 400 });
	}
	if (!body || typeof body !== 'object')
		return json({ error: 'Invalid chat request.' }, { status: 400 });
	const { tripId, requestId, messages } = body as Record<string, unknown>;
	if (
		typeof tripId !== 'string' ||
		tripId.length > 128 ||
		typeof requestId !== 'string' ||
		!UUID.test(requestId) ||
		!validMessages(messages)
	) {
		return json(
			{ error: 'Provide a trip, request ID, and up to 30 chat messages.' },
			{ status: 400 }
		);
	}
	const usageId = requestId;
	const trip = await getAccessibleTripById(userId, tripId);
	if (!trip) return json({ error: 'Trip not found.' }, { status: 404 });
	const items = await getTripItems(tripId);
	const insights = getTripInsightSummary(trip as Trip, items);
	const system = {
		role: 'system',
		content: buildSystemPrompt({
			...trip,
			contradictions: insights.contradictions,
			packingItems: items
		})
	};
	const history = messages.map(({ role, content }) => ({ role, content }));
	// Keep the newest part of long conversations, rather than accepting an unbounded prompt.
	while (
		history.length > 1 &&
		encoder.encode(JSON.stringify([system, ...history])).length > MAX_PROMPT_BYTES
	)
		history.shift();
	const prompt = [system, ...history];
	if (encoder.encode(JSON.stringify(prompt)).length > MAX_PROMPT_BYTES) {
		return json(
			{ error: 'This trip or message is too large for AI. Shorten your message or trip notes.' },
			{ status: 413 }
		);
	}
	await reconcileUsage(userId);
	const reservation = await reserveUsage({ id: usageId, userId: userId, tripId });
	if (reservation === 'duplicate')
		return json(
			{ error: 'This request was already submitted. Check your credit history before retrying.' },
			{ status: 409 }
		);
	if (reservation === 'rate_limited')
		return json(
			{ error: 'Too many AI requests. Try again in a minute.' },
			{ status: 429, headers: { 'Retry-After': '60' } }
		);
	if (reservation !== 'reserved')
		return json({ error: 'Add AI credit before sending a message.' }, { status: 402 });

	if (testMode) {
		// Stripe test money cannot pay for real inference. Exercise the same wallet
		// settlement path with an explicitly simulated response and cost.
		await settleUsage({
			id: usageId,
			userId,
			providerCostMicroUsd: 3000,
			promptTokens: 100,
			completionTokens: 30
		});
		const content =
			'Test response only — no AI provider was called. Pack travel documents, weather-appropriate clothing, and any essential medication.';
		return new Response(`data: ${JSON.stringify({ content })}\n\ndata: [DONE]\n\n`, {
			headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' }
		});
	}

	let upstream: Response;
	try {
		upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': event.url.origin,
				'X-Title': 'PackPal'
			},
			body: JSON.stringify({
				model: 'anthropic/claude-sonnet-4',
				messages: prompt,
				stream: true,
				max_tokens: 1024,
				// Combined with the 16 KiB text-only prompt and 1024 output tokens, these
				// caps fit within the disclosed $0.30 retail hold, including a generous
				// per-message token overhead. Disallow additional per-request pricing.
				provider: { max_price: { prompt: 5, completion: 20, request: 0 }, require_parameters: true }
			}),
			signal: AbortSignal.timeout(90_000)
		});
	} catch {
		// The provider might have accepted this request. Preserve its hold until cost is known.
		return json(
			{ error: 'The AI request could not be confirmed. Its credit hold is pending review.' },
			{ status: 502 }
		);
	}
	if (!upstream.ok || !upstream.body) {
		if ([400, 401, 402, 403, 404, 422, 429].includes(upstream.status)) {
			await releaseUsage(usageId, userId);
		}
		return json(
			{ error: 'The AI provider is unavailable. Check your credit history before retrying.' },
			{ status: 502 }
		);
	}

	let connected = true;
	const reader = upstream.body.getReader();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const send = (value: unknown) => {
				if (!connected) return;
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
				} catch {
					connected = false;
				}
			};
			const work = (async () => {
				const decoder = new TextDecoder();
				let buffer = '';
				let generationId: string | undefined;
				const accounting: { usage: ReturnType<typeof parseProviderUsage> } = { usage: null };
				let failed = false;
				async function consume(line: string) {
					if (!line.startsWith('data:')) return;
					const data = line.slice(5).trim();
					if (!data || data === '[DONE]') return;
					let chunk: {
						id?: unknown;
						error?: unknown;
						usage?: unknown;
						choices?: { delta?: { content?: unknown } }[];
					};
					try {
						const value: unknown = JSON.parse(data);
						if (!value || typeof value !== 'object') return;
						chunk = value;
					} catch {
						return;
					}
					if (!generationId && typeof chunk.id === 'string' && chunk.id.length <= 200) {
						const id = chunk.id;
						generationId = id;
						await recordGeneration(usageId, userId, id);
					}
					if (chunk.error) failed = true;
					const parsed = parseProviderUsage(chunk.usage);
					if (parsed) accounting.usage = parsed;
					const content = chunk.choices?.[0]?.delta?.content;
					if (typeof content === 'string' && content) send({ content });
				}
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						buffer += decoder.decode(value, { stream: true });
						if (buffer.length > 131_072) throw new Error('Oversized upstream event');
						let newline;
						while ((newline = buffer.indexOf('\n')) !== -1) {
							const line = buffer.slice(0, newline);
							buffer = buffer.slice(newline + 1);
							await consume(line);
						}
					}
					await consume(buffer + decoder.decode());
					if (accounting.usage) await settleUsage({ id: usageId, userId, ...accounting.usage });
					if (failed) send({ error: 'The AI provider could not complete this response.' });
					if (!accounting.usage)
						send({
							error: 'Usage confirmation is pending. Check your credit history before retrying.'
						});
				} catch {
					// A disconnect or uncertain provider error never releases possibly spent credit.
					send({
						error:
							'The response was interrupted. Its credit hold will be reconciled when usage is confirmed.'
					});
					console.error('AI request requires usage reconciliation', usageId);
				} finally {
					if (connected) {
						try {
							controller.enqueue(encoder.encode('data: [DONE]\n\n'));
							controller.close();
						} catch {
							/* Client disconnected. */
						}
					}
				}
			})();
			// Continue accounting if a browser closes the stream. Workers may still stop
			// background work after their grace period; persisted holds remain fail-closed.
			event.platform?.context.waitUntil(work);
		},
		cancel() {
			connected = false;
		}
	});
	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' }
	});
};
