import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const state = vi.hoisted(() => ({
	sqlite: null as InstanceType<typeof Database> | null,
	privateEnv: {
		STRIPE_SECRET_KEY: 'sk_test_webhook' as string,
		STRIPE_WEBHOOK_SECRET: 'whsec_webhook' as string,
		STRIPE_MODE: 'test' as string
	},
	fetch: vi.fn<typeof fetch>(),
	paymentIntent: null as Record<string, unknown> | null,
	charge: null as Record<string, unknown> | null,
	dispute: null as Record<string, unknown> | null,
	requests: [] as { method: string; path: string }[]
}));

vi.mock('$env/dynamic/private', () => ({ env: state.privateEnv }));

vi.mock('$lib/server/db', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { applyMigrations, createSqliteDb } = await import('$lib/server/sqlite');

	const sqlite = new Database(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	applyMigrations(sqlite);
	state.sqlite = sqlite;

	return { getDb: () => createSqliteDb(sqlite) };
});

import { POST } from './webhook/+server';
import { createPurchase, attachCheckoutSession } from '$lib/server/billing-wallet';
import { clearAllTables, insertTestUser } from '$lib/server/test-db-helpers';

const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = 'user-1';
const PAYMENT_INTENT_ID = 'pi_packpal_test';
const CHARGE_ID = 'ch_packpal_test';
const CHECKOUT_SESSION_ID = 'cs_packpal_test';
const WEBHOOK_SECRET = 'whsec_webhook';

function charge(overrides: Record<string, unknown> = {}) {
	return {
		id: CHARGE_ID,
		object: 'charge',
		amount: 500,
		amount_captured: 500,
		amount_refunded: 0,
		currency: 'usd',
		paid: true,
		captured: true,
		disputed: false,
		payment_intent: PAYMENT_INTENT_ID,
		...overrides
	};
}

function paymentIntent(overrides: Record<string, unknown> = {}) {
	return {
		id: PAYMENT_INTENT_ID,
		object: 'payment_intent',
		amount: 500,
		amount_received: 500,
		currency: 'usd',
		status: 'succeeded',
		metadata: { packpal_purchase_id: REQUEST_ID, packpal_user_id: USER_ID },
		latest_charge: charge(),
		...overrides
	};
}

function eventPayload(type: string, object: Record<string, unknown>, livemode = false): string {
	return JSON.stringify({
		id: `evt_${type.replaceAll('.', '_')}`,
		object: 'event',
		api_version: '2025-10-29.clover',
		created: Math.floor(Date.now() / 1000),
		data: { object },
		livemode,
		pending_webhooks: 1,
		request: { id: null, idempotency_key: null },
		type
	});
}

function checkoutCompletedEvent() {
	return eventPayload('checkout.session.completed', {
		id: CHECKOUT_SESSION_ID,
		object: 'checkout.session',
		mode: 'payment',
		payment_intent: PAYMENT_INTENT_ID,
		payment_status: 'paid',
		status: 'complete',
		metadata: { packpal_purchase_id: REQUEST_ID, packpal_user_id: USER_ID }
	});
}

function chargeRefundedEvent() {
	return eventPayload('charge.refunded', charge());
}

function disputeEvent(type: 'charge.dispute.created' | 'charge.dispute.closed') {
	return eventPayload(type, {
		id: 'dp_packpal_test',
		object: 'dispute',
		charge: CHARGE_ID,
		payment_intent: null,
		status: type.endsWith('.created') ? 'needs_response' : 'won'
	});
}

function signedHeader(payload: string): string {
	const timestamp = Math.floor(Date.now() / 1000);
	const digest = createHmac('sha256', WEBHOOK_SECRET)
		.update(`${timestamp}.${payload}`)
		.digest('hex');
	return `t=${timestamp},v1=${digest}`;
}

function webhookRequest(payload: string, signature = signedHeader(payload)) {
	const request = new Request('https://packpal.test/api/billing/webhook', {
		method: 'POST',
		headers: { 'stripe-signature': signature },
		body: payload
	});
	return {
		request,
		url: new URL(request.url),
		params: {},
		cookies: { get: () => undefined },
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

async function seedPurchase() {
	await createPurchase({ id: REQUEST_ID, userId: USER_ID, amountCents: 500 });
	await attachCheckoutSession(REQUEST_ID, USER_ID, CHECKOUT_SESSION_ID);
}

function creditedMicroUsd(): number {
	const row = state
		.sqlite!.prepare('SELECT credited_micro_usd FROM billing_purchases WHERE id = ?')
		.get(REQUEST_ID) as { credited_micro_usd: number };
	return row.credited_micro_usd;
}

function stripeResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'request-id': 'req_packpal_test' }
	});
}

beforeEach(() => {
	if (state.sqlite) {
		state.sqlite.exec('DELETE FROM billing_purchases; DELETE FROM ai_usage;');
		clearAllTables(state.sqlite);
		insertTestUser(state.sqlite, { id: USER_ID, username: 'alice', displayName: 'Alice' });
	}
	state.privateEnv.STRIPE_SECRET_KEY = 'sk_test_webhook';
	state.privateEnv.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
	state.privateEnv.STRIPE_MODE = 'test';
	state.paymentIntent = paymentIntent();
	state.charge = charge();
	state.dispute = {
		id: 'dp_packpal_test',
		object: 'dispute',
		charge: CHARGE_ID,
		payment_intent: null,
		status: 'needs_response'
	};
	state.requests = [];
	state.fetch.mockReset();
	state.fetch.mockImplementation(async (input, init) => {
		const url = new URL(String(input));
		const method = (init?.method ?? 'GET').toUpperCase();
		state.requests.push({ method, path: url.pathname });

		if (url.pathname === `/v1/payment_intents/${PAYMENT_INTENT_ID}`) {
			return stripeResponse(state.paymentIntent);
		}
		if (url.pathname === `/v1/charges/${CHARGE_ID}`) {
			return stripeResponse(state.charge);
		}
		if (url.pathname === '/v1/disputes/dp_packpal_test') {
			return stripeResponse(state.dispute);
		}
		return stripeResponse({ error: { message: 'Unexpected Stripe test request' } }, 404);
	});
	vi.stubGlobal('fetch', state.fetch);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('POST /api/billing/webhook', () => {
	it('verifies the exact raw request body before any Stripe API or wallet work', async () => {
		await seedPurchase();
		const original = chargeRefundedEvent();
		const changed = original.replace('charge.refunded', 'charge.refundee');
		const response = await POST(webhookRequest(changed, signedHeader(original)));
		expect(response.status).toBe(400);
		expect(state.requests).toHaveLength(0);
		expect(creditedMicroUsd()).toBe(0);
	});

	it('returns 503 when Stripe secrets are missing', async () => {
		state.privateEnv.STRIPE_WEBHOOK_SECRET = '';
		const response = await POST(webhookRequest(checkoutCompletedEvent()));
		expect(response.status).toBe(503);
		expect(state.requests).toHaveLength(0);
	});

	it('rejects a verified event from the wrong Stripe mode before API or wallet work', async () => {
		await seedPurchase();
		const payload = eventPayload(
			'checkout.session.completed',
			{
				id: CHECKOUT_SESSION_ID,
				object: 'checkout.session',
				mode: 'payment',
				payment_intent: PAYMENT_INTENT_ID,
				payment_status: 'paid',
				status: 'complete',
				metadata: { packpal_purchase_id: REQUEST_ID, packpal_user_id: USER_ID }
			},
			true
		);
		const response = await POST(webhookRequest(payload));
		expect(response.status).toBe(400);
		expect(state.requests).toHaveLength(0);
		expect(creditedMicroUsd()).toBe(0);
	});

	it('grants only a succeeded, captured, paid payment and ignores duplicate events', async () => {
		await seedPurchase();
		const payload = checkoutCompletedEvent();
		const first = await POST(webhookRequest(payload));
		expect(first.status).toBe(200);
		expect(creditedMicroUsd()).toBe(5_000_000);

		const duplicate = await POST(webhookRequest(payload));
		expect(duplicate.status).toBe(200);
		expect(creditedMicroUsd()).toBe(5_000_000);
		expect(
			state
				.sqlite!.prepare('SELECT payment_intent_id FROM billing_purchases WHERE id = ?')
				.get(REQUEST_ID)
		).toEqual({
			payment_intent_id: PAYMENT_INTENT_ID
		});
	});

	it('does not grant credit for unpaid or incomplete PaymentIntents', async () => {
		await seedPurchase();
		state.paymentIntent = paymentIntent({ status: 'requires_action', amount_received: 0 });
		const response = await POST(webhookRequest(checkoutCompletedEvent()));
		expect(response.status).toBe(200);
		expect(creditedMicroUsd()).toBe(0);
	});

	it('rejects payment currency, amount, and user metadata mismatches', async () => {
		await seedPurchase();
		state.paymentIntent = paymentIntent({ currency: 'eur' });
		const wrongCurrency = await POST(webhookRequest(checkoutCompletedEvent()));
		expect(wrongCurrency.status).toBe(400);
		expect(creditedMicroUsd()).toBe(0);

		state.paymentIntent = paymentIntent({ amount_received: 499 });
		const wrongAmount = await POST(webhookRequest(checkoutCompletedEvent()));
		expect(wrongAmount.status).toBe(400);
		expect(creditedMicroUsd()).toBe(0);

		state.paymentIntent = paymentIntent({ latest_charge: charge({ amount_captured: 499 }) });
		const wrongChargeAmount = await POST(webhookRequest(checkoutCompletedEvent()));
		expect(wrongChargeAmount.status).toBe(400);
		expect(creditedMicroUsd()).toBe(0);

		state.paymentIntent = paymentIntent({
			metadata: { packpal_purchase_id: REQUEST_ID, packpal_user_id: 'somebody-else' }
		});
		const wrongUser = await POST(webhookRequest(chargeRefundedEvent()));
		expect(wrongUser.status).toBe(400);
		expect(creditedMicroUsd()).toBe(0);
	});

	it('uses current charge refund state instead of the event snapshot', async () => {
		await seedPurchase();
		const paid = await POST(webhookRequest(checkoutCompletedEvent()));
		expect(paid.status).toBe(200);
		expect(creditedMicroUsd()).toBe(5_000_000);

		state.paymentIntent = paymentIntent({ latest_charge: charge({ amount_refunded: 250 }) });
		state.charge = charge({ amount_refunded: 250 });
		const refund = await POST(webhookRequest(chargeRefundedEvent()));
		expect(refund.status).toBe(200);
		expect(creditedMicroUsd()).toBe(2_500_000);
	});

	it('uses the current charge dispute state for created and closed events', async () => {
		await seedPurchase();
		const paid = await POST(webhookRequest(checkoutCompletedEvent()));
		expect(paid.status).toBe(200);
		expect(creditedMicroUsd()).toBe(5_000_000);

		state.paymentIntent = paymentIntent({ latest_charge: charge({ disputed: true }) });
		state.charge = charge({ disputed: true });
		state.dispute = { ...state.dispute, status: 'needs_response' };
		const created = await POST(webhookRequest(disputeEvent('charge.dispute.created')));
		expect(created.status).toBe(200);
		expect(creditedMicroUsd()).toBe(0);
		expect(state.requests).toContainEqual({ method: 'GET', path: `/v1/charges/${CHARGE_ID}` });

		state.paymentIntent = paymentIntent({ latest_charge: charge({ disputed: false }) });
		state.charge = charge({ disputed: false });
		state.dispute = { ...state.dispute, status: 'won' };
		const closed = await POST(webhookRequest(disputeEvent('charge.dispute.closed')));
		expect(closed.status).toBe(200);
		expect(creditedMicroUsd()).toBe(5_000_000);

		const outOfOrderCreated = await POST(webhookRequest(disputeEvent('charge.dispute.created')));
		expect(outOfOrderCreated.status).toBe(200);
		expect(creditedMicroUsd()).toBe(5_000_000);
	});

	it('acknowledges unrelated Stripe events without a PackPal metadata marker', async () => {
		await seedPurchase();
		state.paymentIntent = paymentIntent({ metadata: {} });
		const payload = eventPayload('charge.refunded', charge());
		const response = await POST(webhookRequest(payload));
		expect(response.status).toBe(200);
		expect(creditedMicroUsd()).toBe(0);
	});

	it('returns 500 for transient Stripe API failures so Stripe can retry', async () => {
		await seedPurchase();
		state.fetch.mockImplementation(async () =>
			stripeResponse({ error: { message: 'temporary' } }, 500)
		);
		const response = await POST(webhookRequest(checkoutCompletedEvent()));
		expect(response.status).toBe(500);
		expect(creditedMicroUsd()).toBe(0);
	});
});
