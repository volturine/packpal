import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// Set up in-memory test DB mock
const helpers = vi.hoisted(() => {
	return { sqliteRef: null as InstanceType<typeof Database> | null };
});

vi.mock('$lib/server/db', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { TEST_DDL } = await import('./test-db-helpers');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');

	const sqlite = new Database(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	sqlite.exec(TEST_DDL);
	helpers.sqliteRef = sqlite;

	return { db: drizzle({ client: sqlite }) };
});

// Import AFTER mock declaration
import { getTripItems, enrichTrip } from '$lib/server/trip-enrichment';
import type { AccessibleTripRecord } from '$lib/server/trip-access';
import {
	clearAllTables,
	insertTestUser,
	insertTestTrip,
	insertTestPackingItem,
	insertTestCollaborator
} from './test-db-helpers';

beforeEach(() => {
	if (helpers.sqliteRef) {
		clearAllTables(helpers.sqliteRef);
	}
});

const NOW = Date.now();
const WEEK = 7 * 24 * 60 * 60 * 1000;

function seedData() {
	const sqlite = helpers.sqliteRef!;
	insertTestUser(sqlite, { id: 'user-1', username: 'alice', displayName: 'Alice' });
	insertTestUser(sqlite, { id: 'user-2', username: 'bob', displayName: 'Bob' });

	insertTestTrip(sqlite, {
		id: 'trip-1',
		userId: 'user-1',
		name: 'Beach Trip',
		destination: 'Bali',
		startDate: NOW + WEEK,
		endDate: NOW + 2 * WEEK,
		activities: ['beach', 'snorkeling'],
		climate: 'tropical'
	});

	insertTestPackingItem(sqlite, {
		id: 'item-1',
		tripId: 'trip-1',
		userId: 'user-1',
		name: 'Passport',
		category: 'Documents & Money',
		packed: false,
		priority: 'must'
	});

	insertTestPackingItem(sqlite, {
		id: 'item-2',
		tripId: 'trip-1',
		userId: 'user-1',
		name: 'Sunscreen',
		category: 'Toiletries & Hygiene',
		packed: true,
		priority: 'normal'
	});

	insertTestPackingItem(sqlite, {
		id: 'item-3',
		tripId: 'trip-1',
		userId: 'user-1',
		name: 'T-shirt',
		category: 'Clothing',
		packed: false,
		priority: 'optional'
	});
}

describe('getTripItems', () => {
	it('returns all items for a trip', () => {
		seedData();
		const items = getTripItems('trip-1');
		expect(items).toHaveLength(3);
	});

	it('returns empty array for trip with no items', () => {
		seedData();
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-empty',
			userId: 'user-1',
			name: 'Empty Trip',
			destination: 'Nowhere',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});
		const items = getTripItems('trip-empty');
		expect(items).toEqual([]);
	});

	it('returns items with correct fields', () => {
		seedData();
		const items = getTripItems('trip-1');
		const passport = items.find((i) => i.name === 'Passport');
		expect(passport).toBeDefined();
		expect(passport!.id).toBe('item-1');
		expect(passport!.tripId).toBe('trip-1');
		expect(passport!.category).toBe('Documents & Money');
		expect(passport!.packed).toBe(false);
		expect(passport!.priority).toBe('must');
	});
});

describe('enrichTrip', () => {
	it('returns enriched trip with item counts', () => {
		seedData();

		const tripRecord: AccessibleTripRecord = {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Beach Trip',
			destination: 'Bali',
			country: null,
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK,
			activities: ['beach', 'snorkeling'],
			climate: 'tropical',
			travelers: 1,
			notes: null,
			archivedAt: null,
			createdAt: NOW,
			ownerDisplayName: 'Alice',
			ownerUsername: 'alice',
			isShared: false
		};

		const result = enrichTrip(tripRecord, 'user-1');

		expect(result.itemCount).toBe(3);
		expect(result.packedCount).toBe(1); // only sunscreen
		expect(result.criticalUnpackedCount).toBeGreaterThanOrEqual(1); // passport is critical
		expect(result.isShared).toBe(false);
		expect(result.ownerDisplayName).toBe('Alice');
	});

	it('includes collaborator count', () => {
		seedData();
		insertTestCollaborator(helpers.sqliteRef!, {
			id: 'collab-1',
			tripId: 'trip-1',
			userId: 'user-2',
			invitedByUserId: 'user-1'
		});

		const tripRecord: AccessibleTripRecord = {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Beach Trip',
			destination: 'Bali',
			country: null,
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK,
			activities: ['beach', 'snorkeling'],
			climate: 'tropical',
			travelers: 1,
			notes: null,
			archivedAt: null,
			createdAt: NOW,
			ownerDisplayName: 'Alice',
			ownerUsername: 'alice',
			isShared: false
		};

		const result = enrichTrip(tripRecord, 'user-1');
		expect(result.collaboratorCount).toBe(1);
		expect(result.collaborators).toHaveLength(1);
	});

	it('sets isShared correctly for non-owner viewer', () => {
		seedData();

		const tripRecord: AccessibleTripRecord = {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Beach Trip',
			destination: 'Bali',
			country: null,
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK,
			activities: ['beach', 'snorkeling'],
			climate: 'tropical',
			travelers: 1,
			notes: null,
			archivedAt: null,
			createdAt: NOW,
			ownerDisplayName: 'Alice',
			ownerUsername: 'alice',
			isShared: true
		};

		const result = enrichTrip(tripRecord, 'user-2');
		expect(result.isShared).toBe(true);
	});

	it('includes trip status and countdown', () => {
		seedData();

		const tripRecord: AccessibleTripRecord = {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Beach Trip',
			destination: 'Bali',
			country: null,
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK,
			activities: ['beach', 'snorkeling'],
			climate: 'tropical',
			travelers: 1,
			notes: null,
			archivedAt: null,
			createdAt: NOW,
			ownerDisplayName: 'Alice',
			ownerUsername: 'alice',
			isShared: false
		};

		const result = enrichTrip(tripRecord, 'user-1');
		expect(result.tripStatus).toBe('upcoming');
		expect(result.countdownLabel).toBeDefined();
		expect(result.contradictions).toBeInstanceOf(Array);
	});
});
