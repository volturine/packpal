import { OPENROUTER_API_KEY } from '$app/env/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies } from '#lib/server/auth.js';
import { getWallet } from '#lib/server/billing-wallet.js';
import { reconcileUsage } from '#lib/server/billing-usage.js';
import { getStripeMode, isStripeConfigured } from '#lib/server/stripe.js';
import {
	AI_PRICE_MULTIPLIER,
	AI_RESERVATION_MICRO_USD,
	BILLING_CURRENCY,
	MIN_TOPUP_CENTS,
	MAX_TOPUP_CENTS,
	type BillingSummary
} from '#lib/billing.js';

export const GET: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });
	await reconcileUsage(session.userId);
	const mode = getStripeMode() ?? 'test';
	const summary: BillingSummary = {
		mode,
		...(await getWallet(session.userId)),
		currency: BILLING_CURRENCY,
		priceMultiplier: AI_PRICE_MULTIPLIER,
		minimumTopupCents: MIN_TOPUP_CENTS,
		maximumTopupCents: MAX_TOPUP_CENTS,
		reservationMicroUsd: AI_RESERVATION_MICRO_USD,
		checkoutEnabled: isStripeConfigured(),
		aiEnabled: isStripeConfigured() && (mode === 'test' || Boolean(OPENROUTER_API_KEY))
	};
	return json(summary, { headers: { 'Cache-Control': 'no-store' } });
};
