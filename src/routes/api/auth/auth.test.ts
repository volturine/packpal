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

import { POST as registerPOST } from './register/+server';
import { POST as loginPOST } from './login/+server';
import { POST as logoutPOST } from './logout/+server';
import { GET as meGET } from './me/+server';
import { clearAllTables } from '$lib/server/test-db-helpers';
import { resetRateLimitStore } from '$lib/server/rate-limit';

beforeEach(() => {
	if (helpers.sqliteRef) {
		clearAllTables(helpers.sqliteRef);
	}
	resetRateLimitStore();
});

/** Create a minimal mock RequestEvent */
function createMockEvent(opts: {
	method?: string;
	body?: Record<string, unknown>;
	url?: string;
	cookies?: Record<string, string>;
}) {
	const cookieStore: Record<string, string> = { ...opts.cookies };

	return {
		request: new Request(opts.url ?? 'http://localhost/api/auth', {
			method: opts.method ?? 'POST',
			body: opts.body ? JSON.stringify(opts.body) : undefined,
			headers: opts.body ? { 'Content-Type': 'application/json' } : undefined
		}),
		url: new URL(opts.url ?? 'http://localhost/api/auth'),
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
		fetch: globalThis.fetch,
		_cookieStore: cookieStore // expose for testing
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

describe('POST /api/auth/register', () => {
	it('registers a new user successfully', async () => {
		const event = createMockEvent({
			body: { username: 'testuser', password: 'password123', displayName: 'Test User' }
		});
		const response = await registerPOST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.user).toBeDefined();
		expect(data.user.username).toBe('testuser');
		expect(data.user.displayName).toBe('Test User');
		expect(data.user.id).toBeDefined();
	});

	it('sets a session cookie on registration', async () => {
		const event = createMockEvent({
			body: { username: 'testuser', password: 'password123', displayName: 'Test User' }
		});
		await registerPOST(event);
		expect(event._cookieStore.packpal_session).toBeDefined();
	});

	it('rejects missing fields', async () => {
		const event = createMockEvent({
			body: { username: 'test' }
		});
		const response = await registerPOST(event);
		expect(response.status).toBe(400);
	});

	it('rejects short username', async () => {
		const event = createMockEvent({
			body: { username: 'ab', password: 'password123', displayName: 'Test' }
		});
		const response = await registerPOST(event);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toContain('3 characters');
	});

	it('rejects short password', async () => {
		const event = createMockEvent({
			body: { username: 'testuser', password: '12345', displayName: 'Test' }
		});
		const response = await registerPOST(event);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toContain('6 characters');
	});

	it('rejects duplicate username', async () => {
		const event1 = createMockEvent({
			body: { username: 'testuser', password: 'password123', displayName: 'Test One' }
		});
		await registerPOST(event1);

		const event2 = createMockEvent({
			body: { username: 'testuser', password: 'password456', displayName: 'Test Two' }
		});
		const response = await registerPOST(event2);
		expect(response.status).toBe(409);
		const data = await response.json();
		expect(data.error).toContain('already taken');
	});
});

describe('POST /api/auth/login', () => {
	beforeEach(async () => {
		// Register a user first
		const event = createMockEvent({
			body: { username: 'testuser', password: 'password123', displayName: 'Test User' }
		});
		await registerPOST(event);
	});

	it('logs in with correct credentials', async () => {
		const event = createMockEvent({
			body: { username: 'testuser', password: 'password123' }
		});
		const response = await loginPOST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.user.username).toBe('testuser');
		expect(event._cookieStore.packpal_session).toBeDefined();
	});

	it('rejects wrong password', async () => {
		const event = createMockEvent({
			body: { username: 'testuser', password: 'wrongpassword' }
		});
		const response = await loginPOST(event);
		expect(response.status).toBe(401);
	});

	it('rejects non-existent user', async () => {
		const event = createMockEvent({
			body: { username: 'nonexistent', password: 'password123' }
		});
		const response = await loginPOST(event);
		expect(response.status).toBe(401);
	});

	it('rejects empty credentials', async () => {
		const event = createMockEvent({
			body: { username: '', password: '' }
		});
		const response = await loginPOST(event);
		expect(response.status).toBe(400);
	});
});

describe('POST /api/auth/logout', () => {
	it('clears the session', async () => {
		// Register and get a session
		const regEvent = createMockEvent({
			body: { username: 'testuser', password: 'password123', displayName: 'Test User' }
		});
		await registerPOST(regEvent);
		const sessionId = regEvent._cookieStore.packpal_session;
		expect(sessionId).toBeDefined();

		// Logout
		const logoutEvent = createMockEvent({
			cookies: { packpal_session: sessionId }
		});
		const response = await logoutPOST(logoutEvent);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.ok).toBe(true);
	});
});

describe('GET /api/auth/me', () => {
	it('returns user data for valid session', async () => {
		// Register and get a session
		const regEvent = createMockEvent({
			body: { username: 'testuser', password: 'password123', displayName: 'Test User' }
		});
		await registerPOST(regEvent);
		const sessionId = regEvent._cookieStore.packpal_session;

		// Check /me
		const meEvent = createMockEvent({
			method: 'GET',
			cookies: { packpal_session: sessionId }
		});
		const response = await meGET(meEvent);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.user).not.toBeNull();
		expect(data.user.username).toBe('testuser');
	});

	it('returns null user for no session', async () => {
		const event = createMockEvent({ method: 'GET' });
		const response = await meGET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.user).toBeNull();
	});

	it('returns null user for invalid session', async () => {
		const event = createMockEvent({
			method: 'GET',
			cookies: { packpal_session: 'invalid-session-id' }
		});
		const response = await meGET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.user).toBeNull();
	});
});
