import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import {
	AI_PRICE_MULTIPLIER,
	AI_RESERVATION_MICRO_USD,
	BILLING_CURRENCY,
	MAX_TOPUP_CENTS,
	MIN_TOPUP_CENTS,
	type CreditPurchaseStatus
} from '#lib/billing.js';
import { getDb } from '#lib/server/db.js';
import { aiUsage, billingPurchases, users } from '#lib/server/schema.js';
import { requireStripeMode, type StripeMode } from '#lib/server/billing-mode.js';

type Purchase = typeof billingPurchases.$inferSelect;

function assertValidTopup(amountCents: number): void {
	if (
		!Number.isSafeInteger(amountCents) ||
		amountCents < MIN_TOPUP_CENTS ||
		amountCents > MAX_TOPUP_CENTS
	) {
		throw new RangeError(
			`Top-up amount must be an integer from ${MIN_TOPUP_CENTS} to ${MAX_TOPUP_CENTS} cents`
		);
	}
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError(`${name} must be a non-negative safe integer`);
	}
}

function balanceExpression(userId: string, mode: StripeMode) {
	return sql<number>`
		COALESCE((
			SELECT SUM(credited_micro_usd)
			FROM billing_purchases
			WHERE user_id = ${userId} AND mode = ${mode} AND currency = ${BILLING_CURRENCY}
		), 0) - COALESCE((
			SELECT SUM(COALESCE(charged_micro_usd, reserved_micro_usd))
			FROM ai_usage
			WHERE user_id = ${userId} AND mode = ${mode}
		), 0)
	`;
}

async function getBalanceMicroUsd(userId: string, mode: StripeMode): Promise<number> {
	const [row] = await getDb()
		.select({ balanceMicroUsd: balanceExpression(userId, mode) })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return row?.balanceMicroUsd ?? 0;
}

export async function getWallet(userId: string) {
	const mode = requireStripeMode();
	const db = getDb();
	const [totals] = await db
		.select({
			balanceMicroUsd: balanceExpression(userId, mode),
			heldMicroUsd: sql<number>`COALESCE((
				SELECT SUM(reserved_micro_usd)
				FROM ai_usage
				WHERE user_id = ${userId} AND mode = ${mode} AND charged_micro_usd IS NULL
			), 0)`
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	const purchases = await db
		.select({
			id: billingPurchases.id,
			amountCents: billingPurchases.amountCents,
			creditedMicroUsd: billingPurchases.creditedMicroUsd,
			createdAt: billingPurchases.createdAt,
			paymentIntentId: billingPurchases.paymentIntentId,
			refundedCents: billingPurchases.refundedCents,
			disputeStatus: billingPurchases.disputeStatus
		})
		.from(billingPurchases)
		.where(and(eq(billingPurchases.userId, userId), eq(billingPurchases.mode, mode)))
		.orderBy(desc(billingPurchases.createdAt))
		.limit(20);

	const requests = await db
		.select({
			id: aiUsage.id,
			chargedMicroUsd: aiUsage.chargedMicroUsd,
			reservedMicroUsd: aiUsage.reservedMicroUsd,
			createdAt: aiUsage.createdAt
		})
		.from(aiUsage)
		.where(and(eq(aiUsage.userId, userId), eq(aiUsage.mode, mode)))
		.orderBy(desc(aiUsage.createdAt))
		.limit(20);

	return {
		balanceMicroUsd: totals?.balanceMicroUsd ?? 0,
		heldMicroUsd: totals?.heldMicroUsd ?? 0,
		purchases: purchases.map(({ paymentIntentId, refundedCents, disputeStatus, ...purchase }) => {
			const status: CreditPurchaseStatus = !paymentIntentId
				? 'pending'
				: ['open', 'lost'].includes(disputeStatus)
					? 'disputed'
					: refundedCents === purchase.amountCents
						? 'refunded'
						: refundedCents > 0
							? 'partially_refunded'
							: 'paid';
			return { ...purchase, status };
		}),
		requests
	};
}

export async function createPurchase(input: {
	id: string;
	userId: string;
	amountCents: number;
}): Promise<Purchase> {
	const mode = requireStripeMode();
	assertValidTopup(input.amountCents);
	const db = getDb();
	const [purchase] = await db
		.insert(billingPurchases)
		.values({
			id: input.id,
			userId: input.userId,
			mode,
			amountCents: input.amountCents,
			currency: BILLING_CURRENCY,
			createdAt: Date.now()
		})
		.onConflictDoNothing({ target: billingPurchases.id })
		.returning();

	if (purchase) return purchase;

	const [existing] = await db
		.select()
		.from(billingPurchases)
		.where(and(eq(billingPurchases.id, input.id), eq(billingPurchases.mode, mode)))
		.limit(1);
	if (
		existing &&
		existing.userId === input.userId &&
		existing.mode === mode &&
		existing.amountCents === input.amountCents &&
		existing.currency === BILLING_CURRENCY
	) {
		return existing;
	}
	throw new Error('Purchase ID is already in use with different purchase details');
}

export async function getPurchase(id: string): Promise<Purchase | undefined> {
	const mode = requireStripeMode();
	const [purchase] = await getDb()
		.select()
		.from(billingPurchases)
		.where(and(eq(billingPurchases.id, id), eq(billingPurchases.mode, mode)))
		.limit(1);
	return purchase;
}

export async function attachCheckoutSession(
	id: string,
	userId: string,
	sessionId: string
): Promise<Purchase> {
	const mode = requireStripeMode();
	const db = getDb();
	const [purchase] = await db
		.update(billingPurchases)
		.set({ checkoutSessionId: sessionId })
		.where(
			and(
				eq(billingPurchases.id, id),
				eq(billingPurchases.userId, userId),
				eq(billingPurchases.mode, mode),
				or(
					isNull(billingPurchases.checkoutSessionId),
					eq(billingPurchases.checkoutSessionId, sessionId)
				)
			)
		)
		.returning();
	if (purchase) return purchase;

	const [existing] = await db
		.select()
		.from(billingPurchases)
		.where(
			and(
				eq(billingPurchases.id, id),
				eq(billingPurchases.userId, userId),
				eq(billingPurchases.mode, mode)
			)
		)
		.limit(1);
	if (!existing) {
		throw new Error('Purchase was not found for this user');
	}
	throw new Error('Purchase already has a different checkout session');
}

export async function creditPurchase(input: {
	id: string;
	paymentIntentId: string;
	refundedCents: number;
	disputed: boolean;
	disputeStatus?: 'open' | 'won' | 'lost';
}): Promise<Purchase> {
	const mode = requireStripeMode();
	assertNonNegativeSafeInteger(input.refundedCents, 'refundedCents');
	const db = getDb();
	const incomingDisputeStatus = input.disputeStatus ?? (input.disputed ? 'open' : undefined);
	const disputeStatus = incomingDisputeStatus
		? sql<Purchase['disputeStatus']>`CASE
			WHEN ${billingPurchases.disputeStatus} IN ('won', 'lost')
			THEN ${billingPurchases.disputeStatus}
			ELSE ${incomingDisputeStatus}
		END`
		: billingPurchases.disputeStatus;
	const refundedCents = sql<number>`MAX(${billingPurchases.refundedCents}, ${input.refundedCents})`;
	const [purchase] = await db
		.update(billingPurchases)
		.set({
			paymentIntentId: input.paymentIntentId,
			refundedCents,
			disputeStatus,
			creditedMicroUsd: sql<number>`CASE
				WHEN ${disputeStatus} IN ('open', 'lost') THEN 0
				ELSE (${billingPurchases.amountCents} - ${refundedCents}) * 10000
			END`
		})
		.where(
			and(
				eq(billingPurchases.id, input.id),
				eq(billingPurchases.mode, mode),
				or(
					isNull(billingPurchases.paymentIntentId),
					eq(billingPurchases.paymentIntentId, input.paymentIntentId)
				),
				gte(billingPurchases.amountCents, input.refundedCents)
			)
		)
		.returning();
	if (purchase) return purchase;

	const [existing] = await db
		.select()
		.from(billingPurchases)
		.where(and(eq(billingPurchases.id, input.id), eq(billingPurchases.mode, mode)))
		.limit(1);
	if (!existing) throw new Error('Purchase was not found');
	if (existing.paymentIntentId && existing.paymentIntentId !== input.paymentIntentId) {
		throw new Error('Purchase already has a different payment intent');
	}
	if (input.refundedCents > existing.amountCents) {
		throw new RangeError('refundedCents cannot exceed the purchase amount');
	}
	throw new Error('Purchase could not be credited with this payment intent');
}

export async function reserveUsage(input: {
	id: string;
	userId: string;
	tripId: string;
}): Promise<'reserved' | 'insufficient_credit' | 'duplicate' | 'rate_limited'> {
	const mode = requireStripeMode();
	const now = Date.now();
	const result = await getDb().all(sql`
		INSERT INTO ai_usage (
			id, user_id, mode, trip_id, reserved_micro_usd, created_at
		)
		SELECT
			${input.id}, ${input.userId}, ${mode}, ${input.tripId}, ${AI_RESERVATION_MICRO_USD}, ${now}
		WHERE (
			COALESCE((
				SELECT SUM(credited_micro_usd)
				FROM billing_purchases
				WHERE user_id = ${input.userId} AND mode = ${mode} AND currency = ${BILLING_CURRENCY}
			), 0) - COALESCE((
				SELECT SUM(COALESCE(charged_micro_usd, reserved_micro_usd))
				FROM ai_usage
				WHERE user_id = ${input.userId} AND mode = ${mode}
			), 0)
		) >= ${AI_RESERVATION_MICRO_USD}
		AND (
			SELECT COUNT(*)
			FROM ai_usage
			WHERE user_id = ${input.userId} AND mode = ${mode} AND created_at >= ${now - 60_000}
		) < 20
		ON CONFLICT(id) DO NOTHING
		RETURNING id
	`);
	if (result.length > 0) return 'reserved';

	const [existing] = await getDb()
		.select({ id: aiUsage.id })
		.from(aiUsage)
		.where(and(eq(aiUsage.id, input.id), eq(aiUsage.mode, mode)))
		.limit(1);
	if (existing) return 'duplicate';
	if ((await getBalanceMicroUsd(input.userId, mode)) < AI_RESERVATION_MICRO_USD) {
		return 'insufficient_credit';
	}

	const [recent] = await getDb()
		.select({ count: sql<number>`COUNT(*)` })
		.from(aiUsage)
		.where(
			and(
				eq(aiUsage.userId, input.userId),
				eq(aiUsage.mode, mode),
				gte(aiUsage.createdAt, now - 60_000)
			)
		);
	return (recent?.count ?? 0) >= 20 ? 'rate_limited' : 'insufficient_credit';
}

export async function recordGeneration(
	id: string,
	userId: string,
	generationId: string
): Promise<boolean> {
	const mode = requireStripeMode();
	const updated = await getDb()
		.update(aiUsage)
		.set({ generationId })
		.where(
			and(
				eq(aiUsage.id, id),
				eq(aiUsage.userId, userId),
				eq(aiUsage.mode, mode),
				isNull(aiUsage.chargedMicroUsd),
				or(isNull(aiUsage.generationId), eq(aiUsage.generationId, generationId))
			)
		)
		.returning({ id: aiUsage.id });
	return updated.length > 0;
}

export async function settleUsage(input: {
	id: string;
	userId: string;
	providerCostMicroUsd: number;
	promptTokens: number;
	completionTokens: number;
}): Promise<boolean> {
	const mode = requireStripeMode();
	assertNonNegativeSafeInteger(input.providerCostMicroUsd, 'providerCostMicroUsd');
	assertNonNegativeSafeInteger(input.promptTokens, 'promptTokens');
	assertNonNegativeSafeInteger(input.completionTokens, 'completionTokens');

	const updated = await getDb()
		.update(aiUsage)
		.set({
			chargedMicroUsd: sql<number>`CASE
				WHEN ${input.providerCostMicroUsd} >=
					(${aiUsage.reservedMicroUsd} + ${AI_PRICE_MULTIPLIER - 1}) / ${AI_PRICE_MULTIPLIER}
				THEN ${aiUsage.reservedMicroUsd}
				ELSE ${input.providerCostMicroUsd} * ${AI_PRICE_MULTIPLIER}
			END`,
			providerCostMicroUsd: input.providerCostMicroUsd,
			promptTokens: input.promptTokens,
			completionTokens: input.completionTokens
		})
		.where(
			and(
				eq(aiUsage.id, input.id),
				eq(aiUsage.userId, input.userId),
				eq(aiUsage.mode, mode),
				isNull(aiUsage.chargedMicroUsd)
			)
		)
		.returning({ id: aiUsage.id });
	return updated.length > 0;
}

export async function releaseUsage(id: string, userId: string): Promise<boolean> {
	const mode = requireStripeMode();
	const updated = await getDb()
		.update(aiUsage)
		.set({
			chargedMicroUsd: 0,
			providerCostMicroUsd: null,
			promptTokens: null,
			completionTokens: null
		})
		.where(
			and(
				eq(aiUsage.id, id),
				eq(aiUsage.userId, userId),
				eq(aiUsage.mode, mode),
				isNull(aiUsage.chargedMicroUsd)
			)
		)
		.returning({ id: aiUsage.id });
	return updated.length > 0;
}

export async function getPendingUsage(userId: string) {
	const mode = requireStripeMode();
	const pending = await getDb()
		.select({
			id: aiUsage.id,
			generationId: aiUsage.generationId,
			createdAt: aiUsage.createdAt
		})
		.from(aiUsage)
		.where(
			and(
				eq(aiUsage.userId, userId),
				eq(aiUsage.mode, mode),
				isNull(aiUsage.chargedMicroUsd),
				isNotNull(aiUsage.generationId),
				lte(aiUsage.createdAt, Date.now() - 30_000)
			)
		)
		.orderBy(asc(aiUsage.createdAt))
		.limit(10);

	return pending.flatMap(({ id, generationId, createdAt }) =>
		generationId === null ? [] : [{ id, generationId, createdAt }]
	);
}
