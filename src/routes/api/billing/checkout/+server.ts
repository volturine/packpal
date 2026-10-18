import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BILLING_CURRENCY, MAX_TOPUP_CENTS, MIN_TOPUP_CENTS } from '$lib/billing';
import { getSessionFromCookies } from '$lib/server/auth';
import { createPurchase, getPurchase, attachCheckoutSession } from '$lib/server/billing-wallet';
import { rateLimit } from '$lib/server/rate-limit';
import { getStripe, isStripeConfigured } from '$lib/server/stripe';

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_WINDOW_MS = 60_000;

interface CheckoutBody {
	requestId: string;
	amountCents: number;
}

function isCheckoutBody(value: unknown): value is CheckoutBody {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const body = value as Record<string, unknown>;
	return (
		typeof body.requestId === 'string' &&
		REQUEST_ID_PATTERN.test(body.requestId) &&
		typeof body.amountCents === 'number' &&
		Number.isInteger(body.amountCents) &&
		body.amountCents >= MIN_TOPUP_CENTS &&
		body.amountCents <= MAX_TOPUP_CENTS
	);
}

function isCheckoutUrl(value: string | null): value is string {
	if (!value) return false;
	try {
		const url = new URL(value);
		return (
			url.protocol === 'https:' &&
			url.hostname === 'checkout.stripe.com' &&
			!url.username &&
			!url.password &&
			!url.port
		);
	} catch {
		return false;
	}
}

export const POST: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	if (event.request.headers.get('origin') !== event.url.origin) {
		return json({ error: 'Invalid origin' }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Invalid checkout request' }, { status: 400 });
	}
	if (!isCheckoutBody(body)) {
		return json({ error: 'Invalid checkout request' }, { status: 400 });
	}

	if (!isStripeConfigured()) {
		return json({ error: 'Checkout is unavailable' }, { status: 503 });
	}

	const limit = rateLimit(
		`billing:checkout:${session.userId}`,
		CHECKOUT_RATE_LIMIT,
		CHECKOUT_RATE_WINDOW_MS
	);
	if (!limit.allowed) {
		return json(
			{ error: 'Too many checkout attempts. Try again later.' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
		);
	}

	try {
		const existing = await getPurchase(body.requestId);
		if (
			existing &&
			(existing.userId !== session.userId || existing.amountCents !== body.amountCents)
		) {
			return json({ error: 'Checkout request ID has already been used' }, { status: 409 });
		}

		let purchase = existing;
		if (!purchase) {
			try {
				purchase = await createPurchase({
					id: body.requestId,
					userId: session.userId,
					amountCents: body.amountCents
				});
			} catch (error) {
				const racedPurchase = await getPurchase(body.requestId);
				if (
					racedPurchase &&
					(racedPurchase.userId !== session.userId ||
						racedPurchase.amountCents !== body.amountCents)
				) {
					return json({ error: 'Checkout request ID has already been used' }, { status: 409 });
				}
				throw error;
			}
		}
		if (purchase.userId !== session.userId || purchase.amountCents !== body.amountCents) {
			return json({ error: 'Checkout request ID has already been used' }, { status: 409 });
		}

		const stripe = getStripe();
		if (purchase.checkoutSessionId) {
			const existingCheckout = await stripe.checkout.sessions.retrieve(purchase.checkoutSessionId);
			if (
				existingCheckout.id !== purchase.checkoutSessionId ||
				!isCheckoutUrl(existingCheckout.url)
			) {
				return json({ error: 'Unable to create checkout session' }, { status: 502 });
			}
			return json({ url: existingCheckout.url });
		}

		const origin = event.url.origin;
		const checkout = await stripe.checkout.sessions.create(
			{
				mode: 'payment',
				// Wallet credit is denominated in USD; don't inherit currency conversion
				// from merchant dashboard settings and then reject a converted payment.
				adaptive_pricing: { enabled: false },
				allowed_payment_method_types: ['card'],
				line_items: [
					{
						price_data: {
							currency: BILLING_CURRENCY,
							unit_amount: body.amountCents,
							product_data: { name: 'PackPal AI credits' }
						},
						quantity: 1
					}
				],
				metadata: {
					packpal_purchase_id: body.requestId,
					packpal_user_id: session.userId
				},
				payment_intent_data: {
					metadata: {
						packpal_purchase_id: body.requestId,
						packpal_user_id: session.userId
					}
				},
				success_url: `${origin}/app/billing?checkout=success`,
				cancel_url: `${origin}/app/billing?checkout=canceled`
			},
			{ idempotencyKey: `packpal-credit-${body.requestId}` }
		);

		if (!isCheckoutUrl(checkout.url)) {
			return json({ error: 'Unable to create checkout session' }, { status: 502 });
		}

		await attachCheckoutSession(body.requestId, session.userId, checkout.id);
		return json({ url: checkout.url });
	} catch {
		return json({ error: 'Unable to create checkout session' }, { status: 500 });
	}
};
