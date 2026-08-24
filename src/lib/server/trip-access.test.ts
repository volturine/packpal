import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync as Database } from 'node:sqlite';

// Set up in-memory test DB mock
const helpers = vi.hoisted(() => {
	return { sqliteRef: null as InstanceType<typeof Database> | null };
});

vi.mock('$lib/server/db', async () => {
	const { DatabaseSync: Database } = await import('node:sqlite');
	const { TEST_DDL } = await import('./test-db-helpers');
	const { drizzle } = await import('drizzle-orm/node-sqlite');

	const sqlite = new Database(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	sqlite.exec(TEST_DDL);
	helpers.sqliteRef = sqlite;

	return { db: drizzle({ client: sqlite }) };
});

// Import AFTER mock declaration
import {
	getAccessibleTripIds,
	getAccessibleTrips,
	getAccessibleTripById,
	getTripCollaborators
} from '$lib/server/trip-access';
import {
	clearAllTables,
	insertTestUser,
	insertTestTrip,
	insertTestCollaborator
} from './test-db-helpers';

beforeEach(() => {
	if (helpers.sqliteRef) {
		clearAllTables(helpers.sqliteRef);
	}
});

const NOW = Date.now();
const WEEK = 7 * 24 * 60 * 60 * 1000;

function seedBasicData() {
	const sqlite = helpers.sqliteRef!;
	insertTestUser(sqlite, { id: 'owner', username: 'owner', displayName: 'Trip Owner' });
	insertTestUser(sqlite, { id: 'collab', username: 'collab', displayName: 'Collaborator' });
	insertTestUser(sqlite, { id: 'other', username: 'other', displayName: 'Other User' });

	insertTestTrip(sqlite, {
		id: 'trip-1',
		userId: 'owner',
		name: 'Paris Trip',
		destination: 'Paris',
		startDate: NOW + WEEK,
		endDate: NOW + 2 * WEEK
	});

	insertTestTrip(sqlite, {
		id: 'trip-2',
		userId: 'owner',
		name: 'Tokyo Trip',
		destination: 'Tokyo',
		startDate: NOW + 3 * WEEK,
		endDate: NOW + 4 * WEEK
	});

	insertTestCollaborator(sqlite, {
		id: 'collab-1',
		tripId: 'trip-1',
		userId: 'collab',
		invitedByUserId: 'owner'
	});
}

describe('getAccessibleTripIds', () => {
	it('returns owned trip IDs', () => {
		seedBasicData();
		const ids = getAccessibleTripIds('owner');
		expect(ids).toContain('trip-1');
		expect(ids).toContain('trip-2');
	});

	it('returns shared trip IDs', () => {
		seedBasicData();
		const ids = getAccessibleTripIds('collab');
		expect(ids).toContain('trip-1');
		expect(ids).not.toContain('trip-2');
	});

	it('returns combined owned + shared IDs (deduplicated)', () => {
		seedBasicData();
		// Owner is also a collaborator (edge case) - create a trip owned by collab, shared with owner
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-3',
			userId: 'collab',
			name: 'Collab Trip',
			destination: 'London',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});
		insertTestCollaborator(helpers.sqliteRef!, {
			id: 'collab-2',
			tripId: 'trip-3',
			userId: 'owner',
			invitedByUserId: 'collab'
		});

		const ids = getAccessibleTripIds('owner');
		expect(ids).toContain('trip-1');
		expect(ids).toContain('trip-2');
		expect(ids).toContain('trip-3');
		// Should be deduplicated
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('returns empty array for user with no trips', () => {
		seedBasicData();
		const ids = getAccessibleTripIds('other');
		expect(ids).toEqual([]);
	});
});

describe('getAccessibleTrips', () => {
	it('returns trips with isShared flag for owner', () => {
		seedBasicData();
		const trips = getAccessibleTrips('owner');
		expect(trips.length).toBe(2);
		expect(trips.every((t) => t.isShared === false)).toBe(true);
	});

	it('returns shared trip with isShared=true for collaborator', () => {
		seedBasicData();
		const trips = getAccessibleTrips('collab');
		expect(trips.length).toBe(1);
		expect(trips[0].isShared).toBe(true);
		expect(trips[0].id).toBe('trip-1');
	});

	it('includes owner display name', () => {
		seedBasicData();
		const trips = getAccessibleTrips('collab');
		expect(trips[0].ownerDisplayName).toBe('Trip Owner');
	});

	it('returns empty array for user with no access', () => {
		seedBasicData();
		expect(getAccessibleTrips('other')).toEqual([]);
	});

	it('returns correct trip fields', () => {
		seedBasicData();
		const trips = getAccessibleTrips('owner');
		const trip = trips.find((t) => t.id === 'trip-1')!;

		expect(trip.name).toBe('Paris Trip');
		expect(trip.destination).toBe('Paris');
		expect(trip.userId).toBe('owner');
		expect(trip.startDate).toBe(NOW + WEEK);
		expect(trip.endDate).toBe(NOW + 2 * WEEK);
	});
});

describe('getAccessibleTripById', () => {
	it('returns trip for owner', () => {
		seedBasicData();
		const trip = getAccessibleTripById('owner', 'trip-1');
		expect(trip).not.toBeNull();
		expect(trip!.id).toBe('trip-1');
		expect(trip!.isShared).toBe(false);
	});

	it('returns trip for collaborator with isShared=true', () => {
		seedBasicData();
		const trip = getAccessibleTripById('collab', 'trip-1');
		expect(trip).not.toBeNull();
		expect(trip!.id).toBe('trip-1');
		expect(trip!.isShared).toBe(true);
	});

	it('returns null for non-accessible trip', () => {
		seedBasicData();
		expect(getAccessibleTripById('other', 'trip-1')).toBeNull();
	});

	it('returns null for non-existent trip', () => {
		seedBasicData();
		expect(getAccessibleTripById('owner', 'nonexistent')).toBeNull();
	});

	it('does not allow collaborator to access unshared trips', () => {
		seedBasicData();
		// trip-2 is owned by owner, not shared with collab
		expect(getAccessibleTripById('collab', 'trip-2')).toBeNull();
	});
});

describe('getTripCollaborators', () => {
	it('returns collaborators with user info', () => {
		seedBasicData();
		const collabs = getTripCollaborators('trip-1');
		expect(collabs).toHaveLength(1);
		expect(collabs[0].userId).toBe('collab');
		expect(collabs[0].username).toBe('collab');
		expect(collabs[0].displayName).toBe('Collaborator');
		expect(collabs[0].tripId).toBe('trip-1');
		expect(collabs[0].invitedByUserId).toBe('owner');
	});

	it('returns empty array for trip with no collaborators', () => {
		seedBasicData();
		expect(getTripCollaborators('trip-2')).toEqual([]);
	});

	it('returns multiple collaborators', () => {
		seedBasicData();
		insertTestCollaborator(helpers.sqliteRef!, {
			id: 'collab-3',
			tripId: 'trip-1',
			userId: 'other',
			invitedByUserId: 'owner'
		});

		const collabs = getTripCollaborators('trip-1');
		expect(collabs).toHaveLength(2);
		const userIds = collabs.map((c) => c.userId);
		expect(userIds).toContain('collab');
		expect(userIds).toContain('other');
	});
});
