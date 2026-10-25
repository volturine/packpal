import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
	sqlite: null as InstanceType<typeof Database> | null,
	privateEnv: {
		STRIPE_SECRET_KEY: 'sk_test_checkout' as string,
		STRIPE_WEBHOOK_SECRET: 'whsec_checkout' as string,
		STRIPE_MODE: undefined as string | undefined
	},
	fetch: vi.fn<typeof fetch>(),
	checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_packpal_test' as string,
	requests: [] as { method: string; path: string; idempotencyKey: string | null; body: string }[],
	checkoutSession: null as { id: string; object: string; url: string | null } | null
}));

vi.mock('$app/env/private', () => ({
	get STRIPE_MODE() {
		return state.privateEnv.STRIPE_MODE;
	},
	get STRIPE_SECRET_KEY() {
		return state.privateEnv.STRIPE_SECRET_KEY;
	},
	get STRIPE_WEBHOOK_SECRET() {
		return state.privateEnv.STRIPE_WEBHOOK_SECRET;
	}
}));

vi.mock('#lib/server/db.js', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { applyMigrations, createSqliteDb } = await import('#lib/server/sqlite.js');

	const sqlite = new Database(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	applyMigrations(sqlite);
	state.sqlite = sqlite;

	return { getDb: () => createSqliteDb(sqlite) };
});

import { POST } from './checkout/+server';
import { createSession } from '#lib/server/auth.js';
import { clearAllTables, insertTestUser } from '#lib/server/test-db-helpers.js';
import { resetRateLimitStore } from '#lib/server/rate-limit.js';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const ORIGIN = 'https://packpal.test';

function stripeResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'request-id': 'req_packpal_test' }
	});
}

function checkoutPayload(requestId = REQUEST_ID, amountCents = 500) {
	return { requestId, amountCents };
}

async function createEvent(
	options: {
		userId?: string;
		body?: unknown;
		rawBody?: string;
		origin?: string;
	} = {}
) {
	const cookies: Record<string, string> = {};
	if (options.userId) {
		cookies.packpal_session = await createSession(options.userId);
	}
	const request = new Request(`${ORIGIN}/api/billing/checkout`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin: options.origin ?? ORIGIN
		},
		body: options.rawBody ?? JSON.stringify(options.body ?? checkoutPayload())
	});
	return {
		request,
		url: new URL(request.url),
		params: {},
		cookies: { get: (name: string) => cookies[name] },
		locals: {},
		platform: undefined,
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '' },
		setHeaders: () => {},
		getClientAddress: () => '203.0.113.10',
		fetch: globalThis.fetch
	} as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
	if (state.sqlite) {
		state.sqlite.exec('DELETE FROM billing_purchases; DELETE FROM ai_usage;');
		clearAllTables(state.sqlite);
	}
	state.privateEnv.STRIPE_SECRET_KEY = 'sk_test_checkout';
	state.privateEnv.STRIPE_WEBHOOK_SECRET = 'whsec_checkout';
	state.requests = [];
	state.checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_packpal_test';
	state.checkoutSession = null;
	state.fetch.mockReset();
	state.fetch.mockImplementation(async (input, init) => {
		const url = new URL(String(input));
		const method = (init?.method ?? 'GET').toUpperCase();
		const headers = new Headers(init?.headers);
		state.requests.push({
			method,
			path: url.pathname,
			idempotencyKey: headers.get('idempotency-key'),
			body: typeof init?.body === 'string' ? init.body : ''
		});

		if (url.pathname === '/v1/checkout/sessions' && method === 'POST') {
			state.checkoutSession = {
				id: 'cs_packpal_test',
				object: 'checkout.session',
				url: state.checkoutUrl
			};
			return stripeResponse(state.checkoutSession);
		}
		if (url.pathname === '/v1/checkout/sessions/cs_packpal_test' && method === 'GET') {
			return stripeResponse(state.checkoutSession ?? { id: 'cs_packpal_test', url: null });
		}
		return stripeResponse({ error: { message: 'Unexpected Stripe test request' } }, 404);
	});
	vi.stubGlobal('fetch', state.fetch);
	resetRateLimitStore();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('POST /api/billing/checkout', () => {
	it('requires an authenticated session before accepting a checkout', async () => {
		const response = await POST(await createEvent());
		expect(response.status).toBe(401);
		expect(state.requests).toHaveLength(0);
	});

	it('rejects a cross-origin request and malformed checkout input', async () => {
		insertTestUser(state.sqlite!, { id: 'user-1', username: 'alice', displayName: 'Alice' });
		const crossOrigin = await POST(
			await createEvent({ userId: 'user-1', origin: 'https://evil.test' })
		);
		expect(crossOrigin.status).toBe(403);

		const invalidAmount = await POST(
			await createEvent({ userId: 'user-1', body: checkoutPayload(REQUEST_ID, 499) })
		);
		expect(invalidAmount.status).toBe(400);

		const invalidId = await POST(
			await createEvent({ userId: 'user-1', body: checkoutPayload('request-1', 500) })
		);
		expect(invalidId.status).toBe(400);
		expect(state.requests).toHaveLength(0);
	});

	it('fails closed when either Stripe secret is missing', async () => {
		insertTestUser(state.sqlite!, { id: 'user-1', username: 'alice', displayName: 'Alice' });
		state.privateEnv.STRIPE_WEBHOOK_SECRET = '';
		const response = await POST(await createEvent({ userId: 'user-1' }));
		expect(response.status).toBe(503);
		expect(state.requests).toHaveLength(0);
	});

	it('creates a bounded USD Checkout Session and reuses its URL on retry', async () => {
		insertTestUser(state.sqlite!, { id: 'user-1', username: 'alice', displayName: 'Alice' });
		const first = await POST(await createEvent({ userId: 'user-1' }));
		expect(first.status).toBe(200);
		expect(await first.json()).toEqual({ url: state.checkoutUrl });

		const createRequest = state.requests.find((request) => request.method === 'POST');
		expect(createRequest?.path).toBe('/v1/checkout/sessions');
		expect(createRequest?.idempotencyKey).toBe(`packpal-credit-${REQUEST_ID}`);
		const params = new URLSearchParams(createRequest?.body);
		expect(params.get('adaptive_pricing[enabled]')).toBe('false');
		expect(params.get('mode')).toBe('payment');
		expect(params.get('allowed_payment_method_types[0]')).toBe('card');
		expect(params.get('line_items[0][price_data][currency]')).toBe('usd');
		expect(params.get('line_items[0][price_data][unit_amount]')).toBe('500');
		expect(params.get('line_items[0][price_data][product_data][name]')).toBe('PackPal AI credits');
		expect(params.get('metadata[packpal_purchase_id]')).toBe(REQUEST_ID);
		expect(params.get('metadata[packpal_user_id]')).toBe('user-1');
		expect(params.get('payment_intent_data[metadata][packpal_purchase_id]')).toBe(REQUEST_ID);
		expect(params.get('success_url')).toBe(`${ORIGIN}/app/billing?checkout=success`);
		expect(params.get('cancel_url')).toBe(`${ORIGIN}/app/billing?checkout=canceled`);

		const retry = await POST(await createEvent({ userId: 'user-1' }));
		expect(retry.status).toBe(200);
		expect(await retry.json()).toEqual({ url: state.checkoutUrl });
		expect(state.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
		expect(state.requests.filter((request) => request.method === 'GET')).toHaveLength(1);
	});

	it('rejects request ID reuse by another user or for a different amount', async () => {
		insertTestUser(state.sqlite!, { id: 'user-1', username: 'alice', displayName: 'Alice' });
		insertTestUser(state.sqlite!, { id: 'user-2', username: 'bob', displayName: 'Bob' });
		const created = await POST(await createEvent({ userId: 'user-1' }));
		expect(created.status).toBe(200);

		const otherUser = await POST(await createEvent({ userId: 'user-2' }));
		expect(otherUser.status).toBe(409);

		const otherAmount = await POST(
			await createEvent({ userId: 'user-1', body: checkoutPayload(REQUEST_ID, 600) })
		);
		expect(otherAmount.status).toBe(409);
		expect(state.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
	});

	it('rejects Stripe URLs outside the hosted Checkout origin without attaching them', async () => {
		insertTestUser(state.sqlite!, { id: 'user-1', username: 'alice', displayName: 'Alice' });
		state.checkoutUrl = 'https://evil.test/steal';
		const response = await POST(await createEvent({ userId: 'user-1' }));
		expect(response.status).toBe(502);
		const row = state
			.sqlite!.prepare('SELECT checkout_session_id FROM billing_purchases WHERE id = ?')
			.get(REQUEST_ID) as { checkout_session_id: string | null };
		expect(row.checkout_session_id).toBeNull();
	});

	it('limits checkout creation and retries per authenticated user', async () => {
		insertTestUser(state.sqlite!, { id: 'user-1', username: 'alice', displayName: 'Alice' });
		for (let attempt = 0; attempt < 10; attempt++) {
			const response = await POST(await createEvent({ userId: 'user-1' }));
			expect(response.status).toBe(200);
		}
		const limited = await POST(await createEvent({ userId: 'user-1' }));
		expect(limited.status).toBe(429);
		expect(limited.headers.get('retry-after')).toBeTruthy();
	});
});
