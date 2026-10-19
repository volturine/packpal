import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import type { RequestEvent } from './$types';

// Set up in-memory test DB mock
const helpers = vi.hoisted(() => {
	return { sqliteRef: null as InstanceType<typeof Database> | null };
});

vi.mock('$lib/server/db', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { applyMigrations, createSqliteDb } = await import('$lib/server/sqlite');

	const sqlite = new Database(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	applyMigrations(sqlite);
	helpers.sqliteRef = sqlite;

	return { getDb: () => createSqliteDb(sqlite) };
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

async function createAuthEvent(opts: {
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
		sessionId = await createSession(opts.sessionUserId);
	}

	const cookieStore: Record<string, string> = {};
	if (sessionId) cookieStore['packpal_session'] = sessionId;

	return {
		request: new Request(opts.url ?? 'https://packpal.test/api/chat-messages', {
			method: opts.method ?? 'GET',
			body: opts.body ? JSON.stringify(opts.body) : undefined,
			headers: opts.body ? { 'Content-Type': 'application/json' } : undefined
		}),
		url: new URL(opts.url ?? 'https://packpal.test/api/chat-messages'),
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
	} as unknown as RequestEvent;
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
		const event = await createAuthEvent({
			method: 'GET',
			url: 'https://packpal.test/api/chat-messages?tripId=trip-1'
		});
		const response = await GET(event);
		expect(response.status).toBe(401);
	});

	it('returns 400 without tripId', async () => {
		const event = await createAuthEvent({
			method: 'GET',
			sessionUserId: 'user-1',
			url: 'https://packpal.test/api/chat-messages'
		});
		const response = await GET(event);
		expect(response.status).toBe(400);
	});

	it('returns empty messages for new trip', async () => {
		seedTrip();

		const event = await createAuthEvent({
			method: 'GET',
			sessionUserId: 'user-1',
			url: 'https://packpal.test/api/chat-messages?tripId=trip-1'
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

		const event = await createAuthEvent({
			method: 'GET',
			sessionUserId: 'user-2',
			url: 'https://packpal.test/api/chat-messages?tripId=trip-1'
		});
		const response = await GET(event);
		expect(response.status).toBe(404);
	});
});

describe('POST /api/chat-messages', () => {
	it('adds a message', async () => {
		seedTrip();

		const event = await createAuthEvent({
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

		const event = await createAuthEvent({
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

		const event = await createAuthEvent({
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

		const event = await createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-2',
			body: { tripId: 'trip-1', role: 'user', content: 'Hello from collaborator' }
		});
		const response = await POST(event);
		expect(response.status).toBe(200);
	});
});

describe('chat message validation', () => {
	it.each(['-1', '-2', '0', '101', '1.5', 'Infinity', 'NaN', ''])(
		'rejects invalid limit %j',
		async (limit) => {
			seedTrip();
			const event = await createAuthEvent({
				sessionUserId: 'user-1',
				url: `https://packpal.test/api/chat-messages?tripId=trip-1&limit=${limit}`
			});
			expect((await GET(event)).status).toBe(400);
		}
	);

	it.each(['-1', '1.5', 'Infinity', 'NaN', ''])('rejects invalid cursor %j', async (before) => {
		seedTrip();
		const event = await createAuthEvent({
			sessionUserId: 'user-1',
			url: `https://packpal.test/api/chat-messages?tripId=trip-1&before=${before}`
		});
		expect((await GET(event)).status).toBe(400);
	});

	it('bounds pages and applies the timestamp cursor', async () => {
		seedTrip();
		const insert = helpers.sqliteRef!.prepare(
			'INSERT INTO chat_messages (id,trip_id,user_id,role,content,created_at) VALUES (?,?,?,?,?,?)'
		);
		for (let i = 1; i <= 105; i++)
			insert.run(`message-${i}`, 'trip-1', 'user-1', 'user', `Message ${i}`, i);
		const page = await GET(
			await createAuthEvent({
				sessionUserId: 'user-1',
				url: 'https://packpal.test/api/chat-messages?tripId=trip-1&limit=2&before=100'
			})
		);
		expect(await page.json()).toMatchObject({
			messages: [{ id: 'message-98' }, { id: 'message-99' }],
			hasMore: true
		});
		const first = await GET(
			await createAuthEvent({
				sessionUserId: 'user-1',
				url: 'https://packpal.test/api/chat-messages?tripId=trip-1&before=0'
			})
		);
		expect(await first.json()).toEqual({ messages: [], hasMore: false });
		const maximum = await GET(
			await createAuthEvent({
				sessionUserId: 'user-1',
				url: 'https://packpal.test/api/chat-messages?tripId=trip-1&limit=100'
			})
		);
		const data = await maximum.json();
		expect(data.messages).toHaveLength(100);
		expect(data.hasMore).toBe(true);
	});

	it.each([
		{ role: 'system' },
		{ role: {} },
		{ tripId: [] },
		{ content: [] },
		{ content: 123 },
		{ content: '   ' },
		{ content: 'x'.repeat(16_385) }
	])('rejects invalid message fields %# without writing', async (fields) => {
		seedTrip();
		const event = await createAuthEvent({
			method: 'POST',
			sessionUserId: 'user-1',
			body: { tripId: 'trip-1', role: 'user', content: 'Hello', ...fields }
		});
		expect((await POST(event)).status).toBe(400);
		expect(helpers.sqliteRef!.prepare('SELECT COUNT(*) FROM chat_messages').pluck().get()).toBe(0);
	});

	it.each(['{', 'null', '[]', '42', JSON.stringify({ content: 'x'.repeat(65_536) })])(
		'rejects invalid JSON bodies %# without writing',
		async (body) => {
			seedTrip();
			const event = await createAuthEvent({ method: 'POST', sessionUserId: 'user-1' });
			event.request = new Request(event.url, { method: 'POST', body });
			expect((await POST(event)).status).toBe(400);
			expect(helpers.sqliteRef!.prepare('SELECT COUNT(*) FROM chat_messages').pluck().get()).toBe(
				0
			);
		}
	);
});
