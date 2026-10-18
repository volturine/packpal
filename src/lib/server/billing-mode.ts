import { env } from '$env/dynamic/private';

export type StripeMode = 'test' | 'live';

export function getStripeMode(): StripeMode | null {
	const configuredMode = env.STRIPE_MODE;
	const mode = configuredMode === undefined ? 'test' : configuredMode.trim();
	return mode === 'test' || mode === 'live' ? mode : null;
}

export function requireStripeMode(): StripeMode {
	const mode = getStripeMode();
	if (!mode) throw new Error('Billing is not configured for a valid Stripe mode');
	return mode;
}
