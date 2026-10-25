import { STRIPE_MODE } from '$app/env/private';

export type StripeMode = 'test' | 'live';

export function getStripeMode(): StripeMode | null {
	const mode = STRIPE_MODE === undefined ? 'test' : STRIPE_MODE.trim();
	return mode === 'test' || mode === 'live' ? mode : null;
}

export function requireStripeMode(): StripeMode {
	const mode = getStripeMode();
	if (!mode) throw new Error('Billing is not configured for a valid Stripe mode');
	return mode;
}
