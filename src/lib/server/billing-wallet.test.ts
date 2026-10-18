import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const helpers = vi.hoisted(() => ({ sqliteRef: null as InstanceType<typeof Database> | null }));

vi.mock('$lib/server/db', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { applyMigrations, createSqliteDb } = await import('$lib/server/sqlite');
	const sqlite = new Database(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	applyMigrations(sqlite);
	helpers.sqliteRef = sqlite;
	return { getDb: () => createSqliteDb(sqlite) };
});

import {
	attachCheckoutSession,
	createPurchase,
	creditPurchase,
	getPendingUsage,
	getPurchase,
	getWallet,
	recordGeneration,
	releaseUsage,
	reserveUsage,
	settleUsage
} from '$lib/server/billing-wallet';
import { insertTestTrip, insertTestUser } from './test-db-helpers';

const NOW = Date.now();

function seedUsersAndTrips() {
	const sqlite = helpers.sqliteRef!;
	insertTestUser(sqlite, { id: 'user-1', username: 'user1', displayName: 'User One' });
	insertTestUser(sqlite, { id: 'user-2', username: 'user2', displayName: 'User Two' });
	insertTestTrip(sqlite, {
		id: 'trip-1',
		userId: 'user-1',
		name: 'First trip',
		destination: 'Paris',
		startDate: NOW,
		endDate: NOW + 1_000
	});
	insertTestTrip(sqlite, {
		id: 'trip-2',
		userId: 'user-2',
		name: 'Second trip',
		destination: 'Tokyo',
		startDate: NOW,
		endDate: NOW + 1_000
	});
}

async function purchase(userId = 'user-1', id = 'purchase-1', amountCents = 500) {
	return createPurchase({ id, userId, amountCents });
}

async function fundPurchase(userId = 'user-1', id = 'purchase-1', amountCents = 500) {
	const created = await purchase(userId, id, amountCents);
	await creditPurchase({
		id,
		paymentIntentId: `pi-${id}`,
		refundedCents: 0,
		disputed: false
	});
	return created;
}

async function setCredit(id: string, creditedMicroUsd: number) {
	helpers
		.sqliteRef!.prepare('UPDATE billing_purchases SET credited_micro_usd = ? WHERE id = ?')
		.run(creditedMicroUsd, id);
}

beforeEach(() => {
	if (!helpers.sqliteRef) return;
	// Clear billing rows before their foreign-key parents.
	helpers.sqliteRef.exec(
		'DELETE FROM ai_usage; DELETE FROM billing_purchases; DELETE FROM trips; DELETE FROM users;'
	);
	seedUsersAndTrips();
});

describe('billing wallet persistence', () => {
	it('creates USD purchases idempotently and rejects reused IDs with different details', async () => {
		const created = await purchase();
		const replay = await purchase();

		expect(created.currency).toBe('usd');
		expect(created.creditedMicroUsd).toBe(0);
		expect((await getWallet('user-1')).purchases[0].status).toBe('pending');
		expect(replay).toEqual(created);
		expect(await getPurchase(created.id)).toEqual(created);
		await expect(
			createPurchase({ id: created.id, userId: 'user-2', amountCents: 500 })
		).rejects.toThrow();
		await expect(
			createPurchase({ id: created.id, userId: 'user-1', amountCents: 600 })
		).rejects.toThrow();
	});

	it('rejects free, fractional, unsafe, and out-of-range top-ups', async () => {
		for (const amountCents of [0, -1, 499, 10_001, 500.5, Number.MAX_SAFE_INTEGER + 1]) {
			await expect(
				createPurchase({ id: `bad-${amountCents}`, userId: 'user-1', amountCents })
			).rejects.toThrow(RangeError);
		}
	});

	it('attaches a checkout session idempotently and rejects another owner or session', async () => {
		await purchase();
		const attached = await attachCheckoutSession('purchase-1', 'user-1', 'cs_1');
		expect(attached.checkoutSessionId).toBe('cs_1');
		expect(await attachCheckoutSession('purchase-1', 'user-1', 'cs_1')).toEqual(attached);
		await expect(attachCheckoutSession('purchase-1', 'user-2', 'cs_1')).rejects.toThrow();
		await expect(attachCheckoutSession('purchase-1', 'user-1', 'cs_2')).rejects.toThrow();
	});

	it('applies authoritative refund and dispute snapshots and binds one payment intent', async () => {
		await purchase();
		const partiallyRefunded = await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 10,
			disputed: false
		});
		expect(partiallyRefunded.creditedMicroUsd).toBe(4_900_000);

		const newerRefundSnapshot = await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 100,
			disputed: false
		});
		expect(newerRefundSnapshot.creditedMicroUsd).toBe(4_000_000);

		const disputed = await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: true
		});
		expect(disputed).toMatchObject({
			creditedMicroUsd: 0,
			refundedCents: 100,
			disputeStatus: 'open'
		});

		const disputeResolved = await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 20,
			disputed: false,
			disputeStatus: 'won'
		});
		expect(disputeResolved).toMatchObject({
			creditedMicroUsd: 4_000_000,
			refundedCents: 100,
			disputeStatus: 'won'
		});

		await expect(
			creditPurchase({
				id: 'purchase-1',
				paymentIntentId: 'pi_other',
				refundedCents: 0,
				disputed: false
			})
		).rejects.toThrow();
		await expect(
			creditPurchase({
				id: 'purchase-1',
				paymentIntentId: 'pi_1',
				refundedCents: 501,
				disputed: false
			})
		).rejects.toThrow(RangeError);
		await expect(
			creditPurchase({
				id: 'purchase-1',
				paymentIntentId: 'pi_1',
				refundedCents: -1,
				disputed: false
			})
		).rejects.toThrow(RangeError);
	});

	it('does not restore credit from a stale prerefund snapshot', async () => {
		await purchase();
		await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 200,
			disputed: false
		});

		const staleSnapshot = await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: false
		});

		expect(staleSnapshot).toMatchObject({ creditedMicroUsd: 3_000_000, refundedCents: 200 });
	});

	it('keeps an open dispute frozen when an undisputed paid snapshot arrives', async () => {
		await purchase();
		await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: true
		});

		const stalePaidSnapshot = await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: false
		});

		expect(stalePaidSnapshot).toMatchObject({ creditedMicroUsd: 0, disputeStatus: 'open' });
	});

	it('restores only the net unrefunded credit when an open dispute is won', async () => {
		await purchase();
		await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 125,
			disputed: true
		});

		const won = await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: false,
			disputeStatus: 'won'
		});

		expect(won).toMatchObject({
			creditedMicroUsd: 3_750_000,
			refundedCents: 125,
			disputeStatus: 'won'
		});
	});

	it('does not refreeze credit from a stale open-dispute snapshot after a win', async () => {
		await purchase();
		await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: true
		});
		await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: false,
			disputeStatus: 'won'
		});

		const staleOpenSnapshot = await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: true,
			disputeStatus: 'open'
		});

		expect(staleOpenSnapshot).toMatchObject({ creditedMicroUsd: 5_000_000, disputeStatus: 'won' });
	});

	it('keeps lost disputes terminal and blocks later credit restoration', async () => {
		await purchase();
		await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: true,
			disputeStatus: 'lost'
		});

		const stalePaidSnapshot = await creditPurchase({
			id: 'purchase-1',
			paymentIntentId: 'pi_1',
			refundedCents: 0,
			disputed: false
		});

		expect(stalePaidSnapshot).toMatchObject({ creditedMicroUsd: 0, disputeStatus: 'lost' });
	});

	it('reserves atomically so concurrent requests cannot overspend and IDs are global', async () => {
		await purchase();
		await setCredit('purchase-1', 300_000);

		const outcomes = await Promise.all([
			reserveUsage({ id: 'request-1', userId: 'user-1', tripId: 'trip-1' }),
			reserveUsage({ id: 'request-2', userId: 'user-1', tripId: 'trip-1' })
		]);
		expect(outcomes.filter((outcome) => outcome === 'reserved')).toHaveLength(1);
		expect(outcomes.filter((outcome) => outcome === 'insufficient_credit')).toHaveLength(1);

		const reservedId = helpers
			.sqliteRef!.prepare('SELECT id FROM ai_usage WHERE user_id = ?')
			.pluck()
			.get('user-1') as string;
		expect(await reserveUsage({ id: reservedId, userId: 'user-1', tripId: 'trip-1' })).toBe(
			'duplicate'
		);
		expect(await reserveUsage({ id: reservedId, userId: 'user-2', tripId: 'trip-2' })).toBe(
			'duplicate'
		);
		expect(await getWallet('user-1')).toMatchObject({ balanceMicroUsd: 0, heldMicroUsd: 300_000 });
		expect(await getWallet('user-2')).toMatchObject({
			balanceMicroUsd: 0,
			heldMicroUsd: 0,
			requests: []
		});
	});

	it('enforces the per-user last-minute limit across concurrent reservations', async () => {
		await fundPurchase('user-1', 'purchase-1', 10_000);
		const outcomes = await Promise.all(
			Array.from({ length: 21 }, (_, index) =>
				reserveUsage({ id: `rate-${index}`, userId: 'user-1', tripId: 'trip-1' })
			)
		);
		expect(outcomes.filter((outcome) => outcome === 'reserved')).toHaveLength(20);
		expect(outcomes.filter((outcome) => outcome === 'rate_limited')).toHaveLength(1);
	});

	it('records generation IDs only on pending requests and never replaces a different ID', async () => {
		await fundPurchase();
		expect(await reserveUsage({ id: 'request-1', userId: 'user-1', tripId: 'trip-1' })).toBe(
			'reserved'
		);
		expect(await recordGeneration('request-1', 'user-2', 'gen_1')).toBe(false);
		expect(await recordGeneration('request-1', 'user-1', 'gen_1')).toBe(true);
		expect(await recordGeneration('request-1', 'user-1', 'gen_1')).toBe(true);
		expect(await recordGeneration('request-1', 'user-1', 'gen_2')).toBe(false);

		await settleUsage({
			id: 'request-1',
			userId: 'user-1',
			providerCostMicroUsd: 1,
			promptTokens: 1,
			completionTokens: 1
		});
		expect(await recordGeneration('request-1', 'user-1', 'gen_1')).toBe(false);
	});

	it('settles once at 2x provider cost, caps charges, and releases rejected requests once', async () => {
		await fundPurchase();
		await reserveUsage({ id: 'request-1', userId: 'user-1', tripId: 'trip-1' });
		expect(
			await settleUsage({
				id: 'request-1',
				userId: 'user-1',
				providerCostMicroUsd: 50_000,
				promptTokens: 12,
				completionTokens: 8
			})
		).toBe(true);
		expect(
			await settleUsage({
				id: 'request-1',
				userId: 'user-1',
				providerCostMicroUsd: 100_000,
				promptTokens: 100,
				completionTokens: 100
			})
		).toBe(false);
		expect(await getWallet('user-1')).toMatchObject({
			balanceMicroUsd: 4_900_000,
			heldMicroUsd: 0,
			requests: [{ id: 'request-1', chargedMicroUsd: 100_000, reservedMicroUsd: 300_000 }]
		});

		await reserveUsage({ id: 'request-2', userId: 'user-1', tripId: 'trip-1' });
		expect(
			await settleUsage({
				id: 'request-2',
				userId: 'user-1',
				providerCostMicroUsd: Number.MAX_SAFE_INTEGER,
				promptTokens: 0,
				completionTokens: 0
			})
		).toBe(true);
		expect((await getWallet('user-1')).requests[0].chargedMicroUsd).toBe(300_000);

		await reserveUsage({ id: 'request-3', userId: 'user-1', tripId: 'trip-1' });
		expect(await releaseUsage('request-3', 'user-1')).toBe(true);
		expect(await releaseUsage('request-3', 'user-1')).toBe(false);
		expect(
			await settleUsage({
				id: 'request-3',
				userId: 'user-1',
				providerCostMicroUsd: 1,
				promptTokens: 1,
				completionTokens: 1
			})
		).toBe(false);
	});

	it('rejects negative or unsafe usage amounts and token counts', async () => {
		await fundPurchase();
		await reserveUsage({ id: 'request-1', userId: 'user-1', tripId: 'trip-1' });
		for (const providerCostMicroUsd of [-1, Number.MAX_SAFE_INTEGER + 1]) {
			await expect(
				settleUsage({
					id: 'request-1',
					userId: 'user-1',
					providerCostMicroUsd,
					promptTokens: 0,
					completionTokens: 0
				})
			).rejects.toThrow(RangeError);
		}
		await expect(
			settleUsage({
				id: 'request-1',
				userId: 'user-1',
				providerCostMicroUsd: 0,
				promptTokens: -1,
				completionTokens: 0
			})
		).rejects.toThrow(RangeError);
		await expect(
			settleUsage({
				id: 'request-1',
				userId: 'user-1',
				providerCostMicroUsd: 0,
				promptTokens: 0,
				completionTokens: Number.MAX_SAFE_INTEGER + 1
			})
		).rejects.toThrow(RangeError);
	});

	it('keeps spent usage and its debit after the linked trip is deleted', async () => {
		await fundPurchase();
		await reserveUsage({ id: 'request-1', userId: 'user-1', tripId: 'trip-1' });
		await settleUsage({
			id: 'request-1',
			userId: 'user-1',
			providerCostMicroUsd: 50_000,
			promptTokens: 10,
			completionTokens: 5
		});
		const beforeDelete = await getWallet('user-1');

		helpers.sqliteRef!.prepare('DELETE FROM trips WHERE id = ?').run('trip-1');

		expect(await getWallet('user-1')).toEqual(beforeDelete);
		expect(
			helpers.sqliteRef!.prepare('SELECT trip_id FROM ai_usage WHERE id = ?').get('request-1')
		).toEqual({ trip_id: null });
	});

	it('returns only generation-backed pending records older than 30 seconds, oldest first, capped at ten', async () => {
		await fundPurchase('user-1', 'purchase-1', 10_000);
		await fundPurchase('user-2', 'purchase-2', 10_000);
		for (let index = 0; index < 12; index++) {
			await reserveUsage({ id: `pending-${index}`, userId: 'user-1', tripId: 'trip-1' });
			if (index < 11) await recordGeneration(`pending-${index}`, 'user-1', `gen-${index}`);
		}
		await reserveUsage({ id: 'other-user', userId: 'user-2', tripId: 'trip-2' });
		await recordGeneration('other-user', 'user-2', 'other-generation');
		helpers
			.sqliteRef!.prepare('UPDATE ai_usage SET created_at = ? WHERE user_id = ?')
			.run(Date.now() - 40_000, 'user-1');
		helpers
			.sqliteRef!.prepare('UPDATE ai_usage SET created_at = ? WHERE id = ?')
			.run(Date.now() - 20_000, 'pending-0');

		const pending = await getPendingUsage('user-1');
		expect(pending).toHaveLength(10);
		expect(pending.map(({ id }) => id)).toEqual(
			Array.from({ length: 10 }, (_, index) => `pending-${index + 1}`)
		);
		expect(
			pending.every(
				({ generationId, createdAt }) => generationId.length > 0 && createdAt <= Date.now() - 30_000
			)
		).toBe(true);
	});
});
