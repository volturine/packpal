import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '$app/env/private';
import Stripe from 'stripe';
import { getStripeMode, type StripeMode } from './billing-mode';

export { getStripeMode };
export type { StripeMode };

let stripeClient: Stripe | undefined;
let stripeSecretKey: string | undefined;

function hasMatchingSecretKey(mode: StripeMode | null): boolean {
	const key = STRIPE_SECRET_KEY?.trim();
	if (!mode || !key) return false;
	return mode === 'test'
		? key.startsWith('sk_test_') || key.startsWith('rk_test_')
		: key.startsWith('sk_live_') || key.startsWith('rk_live_');
}

export function isStripeConfigured(): boolean {
	return Boolean(hasMatchingSecretKey(getStripeMode()) && STRIPE_WEBHOOK_SECRET?.trim());
}

export function getStripe(): Stripe {
	const secretKey = STRIPE_SECRET_KEY?.trim();
	if (!secretKey || !STRIPE_WEBHOOK_SECRET?.trim() || !hasMatchingSecretKey(getStripeMode())) {
		throw new Error('Stripe is not configured for the selected mode');
	}

	if (!stripeClient || stripeSecretKey !== secretKey) {
		stripeClient = new Stripe(secretKey, {
			httpClient: Stripe.createFetchHttpClient()
		});
		stripeSecretKey = secretKey;
	}

	return stripeClient;
}

export async function constructStripeWebhookEvent(
	payload: string,
	signature: string
): Promise<Stripe.Event> {
	const webhookSecret = STRIPE_WEBHOOK_SECRET?.trim();
	if (!webhookSecret || !isStripeConfigured()) throw new Error('Stripe is not configured');

	return getStripe().webhooks.constructEventAsync(
		payload,
		signature,
		webhookSecret,
		undefined,
		Stripe.createSubtleCryptoProvider()
	);
}
