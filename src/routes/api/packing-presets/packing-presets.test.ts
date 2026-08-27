import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// Set up in-memory test DB mock
const helpers = vi.hoisted(() => {
	return { sqliteRef: null as InstanceType<typeof Database> | null };
});

vi.mock('$lib/server/db', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { TEST_DDL } = await import('$lib/server/test-db-helpers');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');

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
	insertTestPackingItem
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
	sessionUserId?: string;
}) {
	let sessionId: string | undefined;
	if (opts.sessionUserId) {
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
		request: new Request('http://localhost/api/packing-presets', {
			method: opts.method ?? 'GET',
			body: opts.body ? JSON.stringify(opts.body) : undefined,
			headers: opts.body ? { 'Content-Type': 'application/json' } : undefined
		}),
		url: new URL('http://localhost/api/packing-presets'),
		params: {},
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

describe('GET /api/packing-presets', () => {
	it('returns 401 when not authenticated', async () => {
		const event = createAuthEvent({ method: 'GET' });
		const response = await GET(event);
		expect(response.status).toBe(401);
	});

	it('returns empty array when no presets exist', async () => {
		const event = createAuthEvent({ method: 'GET', sessionUserId: 'user-1' });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual([]);
	});
});

describe('POST /api/packing-presets', () => {
	it('creates a preset directly', async () => {
		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: {
				name: 'Beach Essentials',
				items: [
					{
						name: 'Sunscreen',
						category: 'Toiletries & Hygiene',
						quantity: 1,
						notes: null,
						priority: 'must'
					},
					{ name: 'Swimsuit', category: 'Clothing', quantity: 2, notes: null, priority: 'normal' }
				]
			}
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.id).toBeDefined();
	});

	it('saves a preset from a trip', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		insertTestTrip(helpers.sqliteRef!, {
			id: 'trip-1',
			userId: 'user-1',
			name: 'Beach Trip',
			destination: 'Bali',
			startDate: NOW + WEEK,
			endDate: NOW + 2 * WEEK
		});
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-1',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'Sunscreen',
			category: 'Toiletries & Hygiene'
		});

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: { action: 'saveFromTrip', tripId: 'trip-1', name: 'My Beach Preset' }
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.id).toBeDefined();

		// Verify preset was created with items
		const row = helpers
			.sqliteRef!.prepare('SELECT * FROM packing_presets WHERE id = ?')
			.get(data.id) as Record<string, unknown>;
		expect(row.name).toBe('My Beach Preset');
		const items = JSON.parse(row.items as string);
		expect(items).toHaveLength(1);
		expect(items[0].name).toBe('Sunscreen');
	});

	it('rejects preset with missing name', async () => {
		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: {
				name: '',
				items: [{ name: 'Item', category: 'Cat', quantity: 1, notes: null, priority: 'normal' }]
			}
		});
		const response = await POST(event);
		expect(response.status).toBe(400);
	});
});

describe('PATCH /api/packing-presets', () => {
	it('marks a preset as used', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		helpers.sqliteRef!.exec(
			`INSERT INTO packing_presets (id, user_id, name, items, created_at, last_used_at)
       VALUES ('preset-1', 'user-1', 'Test', '[]', ${NOW}, NULL)`
		);

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: { id: 'preset-1', action: 'markUsed' }
		});
		const response = await PATCH(event);
		expect(response.status).toBe(200);

		const row = helpers
			.sqliteRef!.prepare('SELECT last_used_at FROM packing_presets WHERE id = ?')
			.get('preset-1') as { last_used_at: number | null };
		expect(row.last_used_at).not.toBeNull();
	});

	it('returns 404 for non-owned preset', async () => {
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
		helpers.sqliteRef!.exec(
			`INSERT INTO packing_presets (id, user_id, name, items, created_at, last_used_at)
       VALUES ('preset-1', 'user-1', 'Test', '[]', ${NOW}, NULL)`
		);

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-2',
			body: { id: 'preset-1', action: 'markUsed' }
		});
		const response = await PATCH(event);
		expect(response.status).toBe(404);
	});
});

describe('DELETE /api/packing-presets', () => {
	it('deletes a preset', async () => {
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-1',
			username: 'alice',
			displayName: 'Alice'
		});
		helpers.sqliteRef!.exec(
			`INSERT INTO packing_presets (id, user_id, name, items, created_at, last_used_at)
       VALUES ('preset-1', 'user-1', 'Test', '[]', ${NOW}, NULL)`
		);

		const event = createAuthEvent({
			method: 'DELETE',
			sessionUserId: 'user-1',
			body: { id: 'preset-1' }
		});
		const response = await DELETE(event);
		expect(response.status).toBe(200);

		const row = helpers
			.sqliteRef!.prepare('SELECT id FROM packing_presets WHERE id = ?')
			.get('preset-1');
		expect(row).toBeUndefined();
	});

	it('returns 404 for non-owned preset', async () => {
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
		helpers.sqliteRef!.exec(
			`INSERT INTO packing_presets (id, user_id, name, items, created_at, last_used_at)
       VALUES ('preset-1', 'user-1', 'Test', '[]', ${NOW}, NULL)`
		);

		const event = createAuthEvent({
			method: 'DELETE',
			sessionUserId: 'user-2',
			body: { id: 'preset-1' }
		});
		const response = await DELETE(event);
		expect(response.status).toBe(404);
	});
});
