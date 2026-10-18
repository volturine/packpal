import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	env: {
		STRIPE_SECRET_KEY: undefined as string | undefined,
		STRIPE_WEBHOOK_SECRET: undefined as string | undefined,
		STRIPE_MODE: undefined as string | undefined
	}
}));

vi.mock('$env/dynamic/private', () => ({ env: state.env }));

import { getStripe, getStripeMode, isStripeConfigured } from './stripe';

beforeEach(() => {
	state.env.STRIPE_SECRET_KEY = 'sk_test_local';
	state.env.STRIPE_WEBHOOK_SECRET = 'whsec_local';
	state.env.STRIPE_MODE = undefined;
});

describe('Stripe mode configuration', () => {
	it('defaults an unset local mode to test and accepts matching test secrets', () => {
		expect(getStripeMode()).toBe('test');
		expect(isStripeConfigured()).toBe(true);
		expect(getStripe()).toBeDefined();
	});

	it('accepts Stripe restricted keys when their mode matches', () => {
		state.env.STRIPE_MODE = 'live';
		state.env.STRIPE_SECRET_KEY = 'rk_live_local';
		expect(isStripeConfigured()).toBe(true);
		expect(getStripeMode()).toBe('live');
	});

	it('requires both secrets and a secret key with the configured mode prefix', () => {
		state.env.STRIPE_WEBHOOK_SECRET = '';
		expect(isStripeConfigured()).toBe(false);
		expect(() => getStripe()).toThrow('Stripe is not configured for the selected mode');

		state.env.STRIPE_WEBHOOK_SECRET = 'whsec_local';
		state.env.STRIPE_MODE = 'live';
		expect(isStripeConfigured()).toBe(false);
		expect(() => getStripe()).toThrow('Stripe is not configured for the selected mode');

		state.env.STRIPE_SECRET_KEY = 'pk_test_not_a_secret_key';
		state.env.STRIPE_MODE = 'test';
		expect(isStripeConfigured()).toBe(false);
		expect(() => getStripe()).toThrow('Stripe is not configured for the selected mode');
	});

	it('rejects invalid mode values instead of treating them as test or live', () => {
		state.env.STRIPE_MODE = 'production';
		expect(getStripeMode()).toBeNull();
		expect(isStripeConfigured()).toBe(false);
		expect(() => getStripe()).toThrow('Stripe is not configured for the selected mode');
	});
});
