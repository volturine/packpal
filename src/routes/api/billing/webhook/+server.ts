import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type Stripe from 'stripe';
import { BILLING_CURRENCY } from '$lib/billing';
import { creditPurchase, getPurchase } from '$lib/server/billing-wallet';
import {
	constructStripeWebhookEvent,
	getStripe,
	getStripeMode,
	isStripeConfigured
} from '$lib/server/stripe';

class InvalidPackPalPaymentError extends Error {}

type DisputeStatus = 'open' | 'won' | 'lost';

interface ResolvedPayment {
	paymentIntentId: string | null;
	checkoutSession?: Stripe.Checkout.Session;
	disputeStatus?: DisputeStatus;
}

function objectId(value: string | { id: string } | null): string | null {
	return typeof value === 'string' ? value : (value?.id ?? null);
}

function mapDisputeStatus(status: string): DisputeStatus {
	return status === 'won' || status === 'lost' ? status : 'open';
}

function invalidPayment(): never {
	throw new InvalidPackPalPaymentError();
}

async function paymentIntentIdForEvent(
	stripe: Stripe,
	event: Stripe.Event
): Promise<ResolvedPayment> {
	switch (event.type) {
		case 'checkout.session.completed': {
			const checkoutSession = event.data.object;
			if (!checkoutSession.metadata?.packpal_purchase_id) {
				return { paymentIntentId: null };
			}
			return {
				paymentIntentId: objectId(checkoutSession.payment_intent),
				checkoutSession
			};
		}
		case 'charge.refunded':
			return { paymentIntentId: objectId(event.data.object.payment_intent) };
		case 'charge.dispute.created':
		case 'charge.dispute.closed': {
			const eventDispute = event.data.object;
			const dispute = await stripe.disputes.retrieve(eventDispute.id);
			const disputeStatus = mapDisputeStatus(dispute.status);
			const paymentIntentId =
				objectId(dispute.payment_intent) ?? objectId(eventDispute.payment_intent);
			if (paymentIntentId) return { paymentIntentId, disputeStatus };

			const chargeId = objectId(dispute.charge) ?? objectId(eventDispute.charge);
			if (!chargeId) return { paymentIntentId: null, disputeStatus };
			const charge = await stripe.charges.retrieve(chargeId);
			return { paymentIntentId: objectId(charge.payment_intent), disputeStatus };
		}
		default:
			return { paymentIntentId: null };
	}
}

async function processHandledEvent(event: Stripe.Event): Promise<void> {
	const stripe = getStripe();
	const resolved = await paymentIntentIdForEvent(stripe, event);
	if (!resolved.paymentIntentId) return;

	const paymentIntent = await stripe.paymentIntents.retrieve(resolved.paymentIntentId, {
		expand: ['latest_charge']
	});
	const purchaseId = paymentIntent.metadata.packpal_purchase_id;
	const metadataUserId = paymentIntent.metadata.packpal_user_id;
	const sessionPurchaseId = resolved.checkoutSession?.metadata?.packpal_purchase_id;
	const sessionUserId = resolved.checkoutSession?.metadata?.packpal_user_id;

	// Events without our marker belong to another Stripe integration using this endpoint.
	if (!purchaseId) {
		if (sessionPurchaseId) invalidPayment();
		return;
	}
	if (
		resolved.checkoutSession &&
		(sessionPurchaseId !== purchaseId || sessionUserId !== metadataUserId)
	) {
		invalidPayment();
	}

	const purchase = await getPurchase(purchaseId);
	if (!purchase || metadataUserId !== purchase.userId || purchase.id !== purchaseId) {
		invalidPayment();
	}
	if (
		resolved.checkoutSession &&
		purchase.checkoutSessionId &&
		resolved.checkoutSession.id !== purchase.checkoutSessionId
	) {
		invalidPayment();
	}

	if (
		paymentIntent.currency !== BILLING_CURRENCY ||
		paymentIntent.amount !== purchase.amountCents
	) {
		invalidPayment();
	}
	if (paymentIntent.status !== 'succeeded') return;
	if (
		resolved.checkoutSession?.payment_status !== undefined &&
		resolved.checkoutSession.payment_status !== 'paid'
	) {
		return;
	}
	if (paymentIntent.amount_received !== purchase.amountCents) invalidPayment();

	let latestCharge = paymentIntent.latest_charge;
	if (!latestCharge) return;
	if (typeof latestCharge === 'string') {
		latestCharge = await stripe.charges.retrieve(latestCharge);
	}
	if (!latestCharge.paid || !latestCharge.captured) return;
	if (
		latestCharge.currency !== BILLING_CURRENCY ||
		latestCharge.amount !== purchase.amountCents ||
		latestCharge.amount_captured !== purchase.amountCents
	) {
		invalidPayment();
	}
	if (
		!Number.isInteger(latestCharge.amount_refunded) ||
		latestCharge.amount_refunded < 0 ||
		latestCharge.amount_refunded > purchase.amountCents
	) {
		invalidPayment();
	}

	await creditPurchase({
		id: purchase.id,
		paymentIntentId: paymentIntent.id,
		refundedCents: latestCharge.amount_refunded,
		disputed: latestCharge.disputed,
		...(resolved.disputeStatus ? { disputeStatus: resolved.disputeStatus } : {})
	});
}

export const POST: RequestHandler = async (event) => {
	if (!isStripeConfigured()) {
		return json({ error: 'Webhook processing is unavailable' }, { status: 503 });
	}

	const signature = event.request.headers.get('stripe-signature');
	if (!signature) return json({ error: 'Invalid webhook signature' }, { status: 400 });

	let stripeEvent: Stripe.Event;
	try {
		const payload = await event.request.text();
		stripeEvent = await constructStripeWebhookEvent(payload, signature);
	} catch {
		return json({ error: 'Invalid webhook signature' }, { status: 400 });
	}
	const stripeMode = getStripeMode();
	if (!stripeMode) return json({ error: 'Webhook processing is unavailable' }, { status: 503 });
	if (stripeEvent.livemode !== (stripeMode === 'live')) {
		return json({ error: 'Webhook mode does not match configuration' }, { status: 400 });
	}

	try {
		switch (stripeEvent.type) {
			case 'checkout.session.completed':
			case 'charge.refunded':
			case 'charge.dispute.created':
			case 'charge.dispute.closed':
				await processHandledEvent(stripeEvent);
				break;
			default:
				break;
		}
		return json({ received: true });
	} catch (error) {
		if (error instanceof InvalidPackPalPaymentError) {
			return json({ error: 'Invalid PackPal payment' }, { status: 400 });
		}
		return json({ error: 'Webhook processing failed' }, { status: 500 });
	}
};
