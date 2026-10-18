import { env } from '$env/dynamic/private';
import Stripe from 'stripe';

export type StripeMode = 'test' | 'live';

let stripeClient: Stripe | undefined;
let stripeSecretKey: string | undefined;

export function getStripeMode(): StripeMode | null {
	const configuredMode = env.STRIPE_MODE;
	const mode = configuredMode === undefined ? 'test' : configuredMode.trim();
	return mode === 'test' || mode === 'live' ? mode : null;
}

function hasMatchingSecretKey(mode: StripeMode | null): boolean {
	const key = env.STRIPE_SECRET_KEY?.trim();
	if (!mode || !key) return false;
	return mode === 'test'
		? key.startsWith('sk_test_') || key.startsWith('rk_test_')
		: key.startsWith('sk_live_') || key.startsWith('rk_live_');
}

export function isStripeConfigured(): boolean {
	return Boolean(hasMatchingSecretKey(getStripeMode()) && env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function getStripe(): Stripe {
	const secretKey = env.STRIPE_SECRET_KEY?.trim();
	if (!secretKey || !env.STRIPE_WEBHOOK_SECRET?.trim() || !hasMatchingSecretKey(getStripeMode())) {
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
	const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
	if (!webhookSecret || !isStripeConfigured()) throw new Error('Stripe is not configured');

	return getStripe().webhooks.constructEventAsync(
		payload,
		signature,
		webhookSecret,
		undefined,
		Stripe.createSubtleCryptoProvider()
	);
}
