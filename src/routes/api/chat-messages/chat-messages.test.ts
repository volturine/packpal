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

import { GET, POST } from './+server';
import { createSession } from '$lib/server/auth';
import {
	clearAllTables,
	insertTestUser,
	insertTestTrip,
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
		request: new Request(opts.url ?? 'http://localhost/api/chat-messages', {
			method: opts.method ?? 'GET',
			body: opts.body ? JSON.stringify(opts.body) : undefined,
			headers: opts.body ? { 'Content-Type': 'application/json' } : undefined
		}),
		url: new URL(opts.url ?? 'http://localhost/api/chat-messages'),
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

describe('GET /api/chat-messages', () => {
	it('returns 401 when not authenticated', async () => {
		const event = createAuthEvent({
			method: 'GET',
			url: 'http://localhost/api/chat-messages?tripId=trip-1'
		});
		const response = await GET(event);
		expect(response.status).toBe(401);
	});

	it('returns 400 without tripId', async () => {
		const event = createAuthEvent({
			method: 'GET',
			sessionUserId: 'user-1',
			url: 'http://localhost/api/chat-messages'
		});
		const response = await GET(event);
		expect(response.status).toBe(400);
	});

	it('returns empty messages for new trip', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'GET',
			sessionUserId: 'user-1',
			url: 'http://localhost/api/chat-messages?tripId=trip-1'
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ messages: [], hasMore: false });
	});

	it('returns 404 for non-accessible trip', async () => {
		seedTrip();
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-2',
			username: 'bob',
			displayName: 'Bob'
		});

		const event = createAuthEvent({
			method: 'GET',
			sessionUserId: 'user-2',
			url: 'http://localhost/api/chat-messages?tripId=trip-1'
		});
		const response = await GET(event);
		expect(response.status).toBe(404);
	});
});

describe('POST /api/chat-messages', () => {
	it('adds a message', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: {
				tripId: 'trip-1',
				role: 'user',
				content: 'What should I pack?'
			}
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.id).toBeDefined();

		// Verify message persisted
		const row = helpers
			.sqliteRef!.prepare('SELECT * FROM chat_messages WHERE id = ?')
			.get(data.id) as Record<string, unknown>;
		expect(row.content).toBe('What should I pack?');
		expect(row.role).toBe('user');
	});

	it('rejects messages with missing fields', async () => {
		seedTrip();

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: { tripId: 'trip-1' }
		});
		const response = await POST(event);
		expect(response.status).toBe(400);
	});

	it('rejects messages for non-accessible trip', async () => {
		seedTrip();
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-2',
			username: 'bob',
			displayName: 'Bob'
		});

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-2',
			body: { tripId: 'trip-1', role: 'user', content: 'Hello' }
		});
		const response = await POST(event);
		expect(response.status).toBe(404);
	});

	it('allows collaborators to post messages', async () => {
		seedTrip();
		insertTestUser(helpers.sqliteRef!, {
			id: 'user-2',
			username: 'bob',
			displayName: 'Bob'
		});
		insertTestCollaborator(helpers.sqliteRef!, {
			id: 'collab-1',
			tripId: 'trip-1',
			userId: 'user-2',
			invitedByUserId: 'user-1'
		});

		const event = createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-2',
			body: { tripId: 'trip-1', role: 'user', content: 'Hello from collaborator' }
		});
		const response = await POST(event);
		expect(response.status).toBe(200);
	});
});
