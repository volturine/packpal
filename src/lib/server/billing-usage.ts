import { env } from '$env/dynamic/private';
import { getPendingUsage, settleUsage } from './billing-wallet';
import { getStripeMode } from './stripe';

export function parseProviderUsage(value: unknown) {
	if (!value || typeof value !== 'object') return null;
	const usage = value as Record<string, unknown>;
	const cost = usage.cost;
	const promptTokens = usage.prompt_tokens;
	const completionTokens = usage.completion_tokens;
	if (
		typeof cost !== 'number' ||
		!Number.isFinite(cost) ||
		cost < 0 ||
		typeof promptTokens !== 'number' ||
		!Number.isSafeInteger(promptTokens) ||
		promptTokens < 0 ||
		typeof completionTokens !== 'number' ||
		!Number.isSafeInteger(completionTokens) ||
		completionTokens < 0
	)
		return null;
	// Round provider cost upward to an integer microdollar before pricing it.
	const providerCostMicroUsd = Math.ceil(cost * 1_000_000);
	if (!Number.isSafeInteger(providerCostMicroUsd)) return null;
	return { providerCostMicroUsd, promptTokens, completionTokens };
}

/** Recover completed generations whose final streaming usage could not be saved. */
export async function reconcileUsage(userId: string) {
	if (getStripeMode() !== 'live' || !env.OPENROUTER_API_KEY) return;
	const pending = await getPendingUsage(userId);
	await Promise.all(
		pending.map(async (entry) => {
			if (!entry.generationId) return;
			try {
				const url = new URL('https://openrouter.ai/api/v1/generation');
				url.searchParams.set('id', entry.generationId);
				const response = await fetch(url, {
					headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
					signal: AbortSignal.timeout(5000)
				});
				if (!response.ok) return;
				const result = await response.json();
				const data = result?.data;
				// Do not turn a still-running generation's temporary cost into a final charge.
				if (data?.id !== entry.generationId || typeof data.finish_reason !== 'string') return;
				const usage = parseProviderUsage({
					cost: data.total_cost,
					prompt_tokens: data.native_tokens_prompt,
					completion_tokens: data.native_tokens_completion
				});
				if (usage) await settleUsage({ id: entry.id, userId, ...usage });
			} catch {
				// Retain the hold for a later retry; unknown provider spend is never refunded on a timer.
			}
		})
	);
}
