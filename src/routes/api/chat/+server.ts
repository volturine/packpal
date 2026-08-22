import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimitByIp } from '$lib/server/rate-limit';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

interface TripContext {
	name: string;
	destination: string;
	country?: string | null;
	climate: string;
	activities: string[];
	startDate: number;
	endDate: number;
	travelers: number;
	ownerDisplayName?: string;
	contradictions?: { message: string; severity: 'warning' | 'info' }[];
	packingItems: {
		name: string;
		category: string;
		packed: boolean;
		notes?: string | null;
		priority?: 'must' | 'normal' | 'optional';
	}[];
}

function buildSystemPrompt(trip: TripContext): string {
	const startDate = new Date(trip.startDate).toLocaleDateString();
	const endDate = new Date(trip.endDate).toLocaleDateString();
	const duration = Math.ceil((trip.endDate - trip.startDate) / (1000 * 60 * 60 * 24));
	const packedCount = trip.packingItems.filter((item) => item.packed).length;
	const totalCount = trip.packingItems.length;
	const unpackedItems = trip.packingItems.filter((item) => !item.packed);
	const priorityItems = unpackedItems.filter((item) => item.priority === 'must');

	const categories = new Map<string, string[]>();
	for (const item of unpackedItems) {
		const list = categories.get(item.category) ?? [];
		const detail = [
			item.name,
			item.priority === 'must' ? 'must-pack' : null,
			item.notes ? `note: ${item.notes}` : null
		]
			.filter(Boolean)
			.join(', ');
		list.push(detail);
		categories.set(item.category, list);
	}

	let itemsSummary = '';
	for (const [category, items] of categories) {
		itemsSummary += `\n  ${category}: ${items.join('; ')}`;
	}

	const contradictions = trip.contradictions?.length
		? trip.contradictions.map((contradiction) => `- ${contradiction.message}`).join('\n')
		: '- None identified';

	return `You are PackPal AI, a practical travel packing assistant.

Trip brief:
- Trip: ${trip.name}
- Destination: ${trip.destination}${trip.country ? `, ${trip.country}` : ''}
- Dates: ${startDate} to ${endDate} (${duration} days)
- Climate: ${trip.climate}
- Activities: ${trip.activities.join(', ')}
- Travelers: ${trip.travelers}
- Owner: ${trip.ownerDisplayName ?? 'Unknown'}
- Packing progress: ${packedCount}/${totalCount} items packed
- Must-pack items still unpacked: ${priorityItems.length}

Current contradictions or warnings:
${contradictions}

Unpacked items still on the list:${itemsSummary || '\n  None'}

Rules:
- Be specific, concise, and action-oriented.
- Prioritize unpacked and must-pack items first.
- Call out likely missing essentials based on destination, climate, and activities.
- If useful, include a short section titled "Suggested actions".
- When suggesting concrete checklist additions, format them exactly like:
  ADD_ITEM: item name | category | priority | optional note
- Only emit ADD_ITEM lines for genuinely useful additions.
- Avoid generic filler and avoid repeating the obvious.`;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const { allowed, retryAfterMs } = rateLimitByIp({ getClientAddress }, 'chat:ai', 20, 60_000);
	if (!allowed) {
		return json(
			{ error: 'Too many AI requests. Try again later.' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
		);
	}

	const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;

	if (!OPENROUTER_API_KEY) {
		return json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
	}

	const body = await request.json();
	const { messages, tripContext } = body as {
		messages: ChatMessage[];
		tripContext: TripContext;
	};

	const systemPrompt = buildSystemPrompt(tripContext);
	const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://packpal.app',
			'X-Title': 'PackPal'
		},
		body: JSON.stringify({
			model: 'anthropic/claude-sonnet-4',
			messages: [{ role: 'system', content: systemPrompt }, ...messages],
			stream: true,
			max_tokens: 1024
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		return json({ error: `OpenRouter error: ${errorText}` }, { status: response.status });
	}

	const stream = new ReadableStream({
		async start(controller) {
			const reader = response.body?.getReader();
			if (!reader) {
				controller.close();
				return;
			}

			const decoder = new TextDecoder();
			let buffer = '';

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() ?? '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed || !trimmed.startsWith('data: ')) continue;

						const data = trimmed.slice(6);
						if (data === '[DONE]') {
							controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
							continue;
						}

						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices?.[0]?.delta?.content;
							if (content) {
								controller.enqueue(
									new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`)
								);
							}
						} catch {
							// Skip malformed JSON lines
						}
					}
				}
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
