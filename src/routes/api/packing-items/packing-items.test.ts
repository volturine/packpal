import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Database } from 'bun:sqlite';

// Set up in-memory test DB mock
const helpers = vi.hoisted(() => {
	return { sqliteRef: null as InstanceType<typeof Database> | null };
});

vi.mock('$lib/server/db', async () => {
	const { Database } = await import('bun:sqlite');
	const { TEST_DDL } = await import('$lib/server/test-db-helpers');
	const { drizzle } = await import('drizzle-orm/bun-sqlite');
	const schema = await import('$lib/server/schema');

	const sqlite = new Database(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	sqlite.exec(TEST_DDL);
	helpers.sqliteRef = sqlite;

	return { db: drizzle(sqlite, { schema }) };
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
	url?: string;
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
		request: new Request(opts.url ?? 'http://localhost/api/packing-items', {
			method: opts.method ?? 'GET',
			body: opts.body ? JSON.stringify(opts.body) : undefined,
			headers: opts.body ? { 'Content-Type': 'application/json' } : undefined
		}),
		url: new URL(opts.url ?? 'http://localhost/api/packing-items'),
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

function seedTrip() {
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
}

describe('GET /api/packing-items', () => {
	it('returns 401 when not authenticated', async () => {
		const event = createAuthEvent({
			method: 'GET',
			url: 'http://localhost/api/packing-items?tripId=trip-1'
		});
		const response = await GET(event);
		expect(response.status).toBe(401);
	});

	it('returns 400 without tripId', async () => {
		const event = createAuthEvent({
			method: 'GET',
			sessionUserId: 'user-1',
			url: 'http://localhost/api/packing-items'
		});
		const response = await GET(event);
		expect(response.status).toBe(400);
	});

	it('returns items for a trip', async () => {
		seedTrip();
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-1',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'Passport',
			category: 'Documents & Money'
		});

		const event = createAuthEvent({
			method: 'GET',
			sessionUserId: 'user-1',
			url: 'http://localhost/api/packing-items?tripId=trip-1'
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveLength(1);
		expect(data[0].name).toBe('Passport');
	});
});

describe('POST /api/packing-items', () => {
	it('creates a single item', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: {
				tripId: 'trip-1',
				item: { name: 'New Item', category: 'Clothing', quantity: 2 }
			}
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.id).toBeDefined();

		const row = helpers
			.sqliteRef!.prepare('SELECT * FROM packing_items WHERE id = ?')
			.get(data.id) as Record<string, unknown>;
		expect(row.name).toBe('New Item');
		expect(row.is_custom).toBe(1); // single items are always custom
	});

	it('creates bulk items', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: {
				tripId: 'trip-1',
				items: [
					{ name: 'Item A', category: 'Clothing', quantity: 1, isCustom: false },
					{ name: 'Item B', category: 'Footwear', quantity: 2, isCustom: true }
				]
			}
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.ids).toHaveLength(2);
	});

	it('returns 400 without items or item', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: { tripId: 'trip-1' }
		});
		const response = await POST(event);
		expect(response.status).toBe(400);
	});

	it('returns 404 for non-accessible trip', async () => {
		seedTrip();
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-2',
			username: 'bob',
			displayName: 'Bob'
		});

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-2',
			body: {
				tripId: 'trip-1',
				item: { name: 'Item', category: 'Clothing', quantity: 1 }
			}
		});
		const response = await POST(event);
		expect(response.status).toBe(404);
	});

	it('rejects items with empty names', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: {
				tripId: 'trip-1',
				item: { name: '   ', category: 'Clothing', quantity: 1 }
			}
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain('Item name');
	});

	it('rejects items with invalid quantities', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: {
				tripId: 'trip-1',
				item: { name: 'Socks', category: 'Clothing', quantity: 0 }
			}
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain('Quantity');
	});

	it('rejects bulk items before inserting partial data', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: {
				tripId: 'trip-1',
				items: [
					{ name: 'Valid Item', category: 'Clothing', quantity: 1, isCustom: false },
					{ name: '', category: 'Footwear', quantity: 1, isCustom: true }
				]
			}
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain('Item name');

		const rows = helpers
			.sqliteRef!.prepare('SELECT id FROM packing_items WHERE trip_id = ?')
			.all('trip-1');
		expect(rows).toHaveLength(0);
	});
});

describe('PATCH /api/packing-items', () => {
	it('toggles an item', async () => {
		seedTrip();
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-1',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'Passport',
			category: 'Documents & Money',
			packed: false
		});

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: { action: 'toggle', id: 'item-1' }
		});
		const response = await PATCH(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.ok).toBe(true);
		expect(data.packed).toBe(true);
	});

	it('updates an item', async () => {
		seedTrip();
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-1',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'Passport',
			category: 'Documents & Money'
		});

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: {
				action: 'update',
				id: 'item-1',
				name: 'Updated Passport',
				priority: 'must'
			}
		});
		const response = await PATCH(event);
		expect(response.status).toBe(200);

		const row = helpers
			.sqliteRef!.prepare('SELECT name, priority FROM packing_items WHERE id = ?')
			.get('item-1') as { name: string; priority: string };
		expect(row.name).toBe('Updated Passport');
		expect(row.priority).toBe('must');
	});

	it('rejects invalid item updates', async () => {
		seedTrip();
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-1',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'Passport',
			category: 'Documents & Money'
		});

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: {
				action: 'update',
				id: 'item-1',
				quantity: 0
			}
		});
		const response = await PATCH(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toContain('Quantity');
	});

	it('toggles all items in a category', async () => {
		seedTrip();
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-1',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'T-shirt',
			category: 'Clothing',
			packed: false
		});
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-2',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'Socks',
			category: 'Clothing',
			packed: false
		});
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-3',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'Passport',
			category: 'Documents & Money',
			packed: false
		});

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: { action: 'toggleAll', tripId: 'trip-1', category: 'Clothing', packed: true }
		});
		const response = await PATCH(event);
		expect(response.status).toBe(200);

		// Clothing items should be packed
		const clothing = helpers
			.sqliteRef!.prepare('SELECT packed FROM packing_items WHERE category = ?')
			.all('Clothing') as { packed: number }[];
		expect(clothing.every((i) => i.packed === 1)).toBe(true);

		// Documents should NOT be affected
		const docs = helpers
			.sqliteRef!.prepare('SELECT packed FROM packing_items WHERE category = ?')
			.all('Documents & Money') as { packed: number }[];
		expect(docs[0].packed).toBe(0);
	});

	it('toggles all items in a trip', async () => {
		seedTrip();
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-1',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'T-shirt',
			category: 'Clothing',
			packed: false
		});
		insertTestPackingItem(helpers.sqliteRef!, {
			id: 'item-2',
			tripId: 'trip-1',
			userId: 'user-1',
			name: 'Passport',
			category: 'Documents & Money',
			packed: false
		});

		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: { action: 'toggleTrip', tripId: 'trip-1', packed: true }
		});
		const response = await PATCH(event);
		expect(response.status).toBe(200);

		const items = helpers
			.sqliteRef!.prepare('SELECT packed FROM packing_items WHERE trip_id = ?')
			.all('trip-1') as { packed: number }[];
		expect(items.every((i) => i.packed === 1)).toBe(true);
	});

	it('returns 400 for unknown action', async () => {
		const event = createAuthEvent({
			method: 'PATCH',
			sessionUserId: 'user-1',
			body: { action: 'unknownAction' }
		});
		const response = await PATCH(event);
		expect(response.status).toBe(400);
	});
});

describe('DELETE /api/packing-items', () => {
	it('deletes an item', async () => {
		seedTrip();
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
			body: { id: 'item-1' }
		});
		const response = await DELETE(event);
		expect(response.status).toBe(200);

		const row = helpers
			.sqliteRef!.prepare('SELECT id FROM packing_items WHERE id = ?')
			.get('item-1');
		expect(row).toBeNull();
	});

	it('returns 404 for non-existent item', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'DELETE',
			sessionUserId: 'user-1',
			body: { id: 'nonexistent' }
		});
		const response = await DELETE(event);
		expect(response.status).toBe(404);
	});
});
