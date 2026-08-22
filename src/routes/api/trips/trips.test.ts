import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync as Database } from 'node:sqlite';

// Set up in-memory test DB mock
const helpers = vi.hoisted(() => {
	return { sqliteRef: null as InstanceType<typeof Database> | null };
});

vi.mock('$lib/server/db', async () => {
	const { DatabaseSync: Database } = await import('node:sqlite');
	const { TEST_DDL } = await import('$lib/server/test-db-helpers');
	const { drizzle } = await import('drizzle-orm/node-sqlite');

	const sqlite = new Database(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	sqlite.exec(TEST_DDL);
	helpers.sqliteRef = sqlite;

	return { db: drizzle({ client: sqlite }) };
});

import { GET, POST, PATCH, DELETE } from './+server';
import { createSession } from '$lib/server/auth';
import {
	clearAllTables,
	insertTestUser,
	insertTestTrip,
	insertTestPackingItem,
	insertTestCollaborator
} from '$lib/server/test-db-helpers';

beforeEach(() => {
	if (helpers.sqliteRef) {
		clearAllTables(helpers.sqliteRef);
	}
});

const NOW = Date.now();
const WEEK = 7 * 24 * 60 * 60 * 1000;

function createAuthEvent(opts: {
	method?: string;
	body?: Record<string, unknown>;
	url?: string;
	sessionUserId?: string;
	params?: Record<string, string>;
}) {
	// Create a real user + session if sessionUserId is provided
	let sessionId: string | undefined;
	if (opts.sessionUserId) {
		// Ensure user exists
		const row = helpers
			.sqliteRef!.prepare('SELECT id FROM users WHERE id = ?')
			.get(opts.sessionUserId);
		if (!row) {
			insertTestUser(helpers.sqliteRef!, {
				id: opts.sessionUserId,
				username: `user_${opts.sessionUserId}`,
				displayName: `User ${opts.sessionUserId}`
			});
		}
		sessionId = createSession(opts.sessionUserId);
	}

	const cookieStore: Record<string, string> = {};
	if (sessionId) cookieStore['packpal_session'] = sessionId;

	return {
		request: new Request(opts.url ?? 'http://localhost/api/trips', {
			method: opts.method ?? 'GET',
			body: opts.body ? JSON.stringify(opts.body) : undefined,
			headers: opts.body ? { 'Content-Type': 'application/json' } : undefined
		}),
		url: new URL(opts.url ?? 'http://localhost/api/trips'),
		params: opts.params ?? {},
		cookies: {
			get: (name: string) => cookieStore[name] ?? undefined,
			set: (name: string, value: string) => {
				cookieStore[name] = value;
			},
			delete: (name: string) => {
				delete cookieStore[name];
			},
			getAll: () => Object.entries(cookieStore).map(([name, value]) => ({ name, value })),
			serialize: () => ''
		},
		locals: {},
		platform: undefined,
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '' },
		setHeaders: () => {},
		getClientAddress: () => '127.0.0.1',
		fetch: globalThis.fetch
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

describe('GET /api/trips', () => {
	it('returns 401 when not authenticated', async () => {
		const event = createAuthEvent({ method: 'GET' });
		const response = await GET(event);
		expect(response.status).toBe(401);
	});

	it('returns empty array when user has no trips', async () => {
		const event = createAuthEvent({ method: 'GET', sessionUserId: 'user-1' });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual([]);
	});

	it('returns user trips', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Paris Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});

		const event = createAuthEvent({ method: 'GET', sessionUserId: 'user-1' });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(1);
		expect(data[0].name).toBe('Paris Trip');
	});
});

describe('POST /api/trips', () => {
	it('returns 401 when not authenticated', async () => {
		const event = createAuthEvent({
			method: 'POST',
			body: {
				name: 'Test Trip',
				destination: 'Paris',
				startDate: NOW,
				endDate: NOW + WEEK,
				activities: ['city_break'],
				climate: 'temperate',
				travelers: 1
			}
		});
		const response = await POST(event);
		expect(response.status).toBe(401);
	});

	it('creates a new trip', async () => {
		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: {
				name: 'Paris Trip',
				destination: 'Paris',
				country: 'France',
				startDate: NOW + WEEK,
				endDate: NOW + 2 * WEEK,
				activities: ['city_break'],
				climate: 'temperate',
				travelers: 2,
				notes: 'Romantic getaway'
			}
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.id).toBeDefined();

		// Verify trip exists in DB
		const row = helpers
			.sqliteRef!.prepare('SELECT * FROM trips WHERE id = ?')
			.get(data.id) as Record<string, unknown>;
		expect(row).toBeDefined();
		expect(row.name).toBe('Paris Trip');
	});

	it('rejects missing required fields', async () => {
		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: { name: 'Test' }
		});
		const response = await POST(event);
		expect(response.status).toBe(400);
	});

	it('adds a collaborator', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-2',
			username: 'bob',
			displayName: 'Bob'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: { action: 'addCollaborator', tripId: 'trip-1', username: 'bob' }
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.ok).toBe(true);

		// Verify collaborator exists
		const row = helpers
			.sqliteRef!.prepare('SELECT * FROM trip_collaborators WHERE trip_id = ? AND user_id = ?')
			.get('trip-1', 'user-2');
		expect(row).toBeDefined();
	});

	it('rejects adding self as collaborator', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: { action: 'addCollaborator', tripId: 'trip-1', username: 'alice' }
		});
		const response = await POST(event);
		expect(response.status).toBe(400);
	});

	it('rejects adding non-existent user as collaborator', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: { action: 'addCollaborator', tripId: 'trip-1', username: 'nonexistent' }
		});
		const response = await POST(event);
		expect(response.status).toBe(404);
	});
});

describe('PATCH /api/trips', () => {
	it('archives a trip', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: { id: 'trip-1', action: 'archive' }
		});
		const response = await PATCH(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.ok).toBe(true);

		const row = helpers
			.sqliteRef!.prepare('SELECT archived_at FROM trips WHERE id = ?')
			.get('trip-1') as { archived_at: number | null };
		expect(row.archived_at).not.toBeNull();
	});

	it('unarchives a trip', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK,
			archivedAt: NOW
		});

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: { id: 'trip-1', action: 'unarchive' }
		});
		const response = await PATCH(event);
		expect(response.status).toBe(200);

		const row = helpers
			.sqliteRef!.prepare('SELECT archived_at FROM trips WHERE id = ?')
			.get('trip-1') as { archived_at: number | null };
		expect(row.archived_at).toBeNull();
	});

	it('updates trip fields', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: { id: 'trip-1', name: 'Updated Trip Name', travelers: 3 }
		});
		const response = await PATCH(event);
		expect(response.status).toBe(200);

		const row = helpers
			.sqliteRef!.prepare('SELECT name, travelers FROM trips WHERE id = ?')
			.get('trip-1') as { name: string; travelers: number };
		expect(row.name).toBe('Updated Trip Name');
		expect(row.travelers).toBe(3);
	});

	it('returns 404 for non-existent trip', async () => {
		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: { id: 'nonexistent', name: 'Test' }
		});
		const response = await PATCH(event);
		expect(response.status).toBe(404);
	});
});

describe('DELETE /api/trips', () => {
	it('deletes a trip and its related data', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-1',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'Passport',
			category: 'Documents & Money'
		});

		const event = createAuthEvent({
			method: 'DELETE',
			sessionUserId: 'user-1',
			body: { id: 'trip-1' }
		});
		const response = await DELETE(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.ok).toBe(true);

		// Trip should be gone
		const trip = helpers.sqliteRef!.prepare('SELECT id FROM trips WHERE id = ?').get('trip-1');
		expect(trip).toBeUndefined();

		// Packing items should be gone
		const items = helpers
			.sqliteRef!.prepare('SELECT id FROM packing_items WHERE trip_id = ?')
			.all('trip-1');
		expect(items).toHaveLength(0);
	});

	it('returns 404 for non-owned trip', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-2',
			username: 'bob',
			displayName: 'Bob'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});

		const event = createAuthEvent({
			method: 'DELETE',
			sessionUserId: 'user-2',
			body: { id: 'trip-1' }
		});
		const response = await DELETE(event);
		expect(response.status).toBe(404);
	});

	it('removes a collaborator', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-2',
			username: 'bob',
			displayName: 'Bob'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Trip',
			destination: 'Paris',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});
		insertTestCollaborator(helpers.sqliteRef!, {
			id: 'collab-1',
			tripId: 'trip-1',
			userId: 'user-2',
			invitedByUserId: 'user-1'
		});

		const event = createAuthEvent({
			method: 'DELETE',
			sessionUserId: 'user-1',
			body: { id: 'trip-1', collaboratorUserId: 'user-2' }
		});
		const response = await DELETE(event);
		expect(response.status).toBe(200);

		const collab = helpers
			.sqliteRef!.prepare('SELECT id FROM trip_collaborators WHERE trip_id = ? AND user_id = ?')
			.get('trip-1', 'user-2');
		expect(collab).toBeUndefined();
	});
});
