import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import type { RequestEvent } from '@sveltejs/kit';

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

import { POST as registerPOST } from './register/+server';
import { POST as loginPOST } from './login/+server';
import { POST as logoutPOST } from './logout/+server';
import { GET as meGET } from './me/+server';
import { PATCH as mePATCH } from './me/+server';
import { clearAllTables } from '$lib/server/test-db-helpers';
import { resetRateLimitStore } from '$lib/server/rate-limit';

beforeEach(() => {
	if (helpers.sqliteRef) {
		clearAllTables(helpers.sqliteRef);
	}
	resetRateLimitStore();
});

type MockRequestEvent = RequestEvent<Record<string, never>, never> & {
	_cookieStore: Record<string, string>;
};

/** Create a minimal mock RequestEvent */
function createMockEvent(opts: {
	method?: string;
	body?: unknown;
	rawBody?: string;
	contentLength?: string;
	url?: string;
	cookies?: Record<string, string>;
}): MockRequestEvent {
	const cookieStore: Record<string, string> = { ...opts.cookies };
	const requestBody =
		opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
	const headers =
		requestBody === undefined
			? undefined
			: {
					'Content-Type': 'application/json',
					...(opts.contentLength ? { 'Content-Length': opts.contentLength } : {})
				};

	return {
		request: new Request(opts.url ?? 'http://localhost/api/auth', {
			method: opts.method ?? 'POST',
			body: requestBody,
			headers
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
	} as unknown as MockRequestEvent;
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

	it('rejects malformed and non-object JSON bodies', async () => {
		for (const rawBody of ['{', 'null', '[]', '"value"', '123', 'true']) {
			resetRateLimitStore();
			const response = await registerPOST(createMockEvent({ rawBody }));
			expect(response.status).toBe(400);
		}
	});

	it('rejects a body larger than 16 KiB based on its actual bytes', async () => {
		const rawBody = JSON.stringify({
			username: 'testuser',
			password: 'password123',
			displayName: 'a'.repeat(16_500)
		});
		const response = await registerPOST(createMockEvent({ rawBody, contentLength: '1' }));

		expect(response.status).toBe(400);
	});

	it('rejects non-string and oversized fields', async () => {
		const invalidBodies = [
			{ username: 7, password: 'password123', displayName: 'Test User' },
			{ username: 'testuser', password: false, displayName: 'Test User' },
			{ username: 'testuser', password: 'password123', displayName: null },
			{ username: 'u'.repeat(101), password: 'password123', displayName: 'Test User' },
			{ username: 'testuser', password: 'password123', displayName: 'd'.repeat(101) },
			{ username: 'testuser', password: 'p'.repeat(1025), displayName: 'Test User' }
		];

		for (const body of invalidBodies) {
			resetRateLimitStore();
			const response = await registerPOST(createMockEvent({ body }));
			expect(response.status).toBe(400);
		}
	});

	it('rejects a display name that becomes empty after sanitization', async () => {
		const response = await registerPOST(
			createMockEvent({
				body: { username: 'testuser', password: 'password123', displayName: '<b></b>' }
			})
		);

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

	it('rejects wrong field types and oversized credentials before password verification', async () => {
		const invalidBodies = [
			{ username: 7, password: 'password123' },
			{ username: 'testuser', password: false },
			{ username: 'u'.repeat(101), password: 'password123' },
			{ username: 'testuser', password: 'p'.repeat(1025) }
		];

		for (const body of invalidBodies) {
			const response = await loginPOST(createMockEvent({ body }));
			expect(response.status).toBe(400);
		}
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

describe('PATCH /api/auth/me', () => {
	it('validates all fields before changing the password', async () => {
		const registrationEvent = createMockEvent({
			body: { username: 'testuser', password: 'password123', displayName: 'Test User' }
		});
		await registerPOST(registrationEvent);

		const patchEvent = createMockEvent({
			cookies: { packpal_session: registrationEvent._cookieStore.packpal_session },
			body: {
				currentPassword: 'password123',
				newPassword: 'changed-password',
				displayName: '<b></b>'
			}
		});
		const response = await mePATCH(patchEvent);
		expect(response.status).toBe(400);

		const oldPasswordLogin = await loginPOST(
			createMockEvent({ body: { username: 'testuser', password: 'password123' } })
		);
		const newPasswordLogin = await loginPOST(
			createMockEvent({ body: { username: 'testuser', password: 'changed-password' } })
		);
		expect(oldPasswordLogin.status).toBe(200);
		expect(newPasswordLogin.status).toBe(401);
	});

	it('rejects wrong types and oversized profile fields', async () => {
		const registrationEvent = createMockEvent({
			body: { username: 'testuser', password: 'password123', displayName: 'Test User' }
		});
		await registerPOST(registrationEvent);
		const cookies = { packpal_session: registrationEvent._cookieStore.packpal_session };
		const invalidBodies = [
			{ displayName: 42 },
			{ currentPassword: [] },
			{ newPassword: false },
			{ newPassword: '' },
			{ displayName: 'd'.repeat(101) },
			{ currentPassword: 'p'.repeat(1025) },
			{ newPassword: 'p'.repeat(1025) }
		];

		for (const body of invalidBodies) {
			const response = await mePATCH(createMockEvent({ cookies, body }));
			expect(response.status).toBe(400);
		}
	});

	it('revokes the user’s other sessions while keeping the calling and unrelated sessions', async () => {
		const registrationEvent = createMockEvent({
			body: { username: 'testuser', password: 'password123', displayName: 'Test User' }
		});
		await registerPOST(registrationEvent);
		const currentSessionId = registrationEvent._cookieStore.packpal_session;
		const unrelatedRegistration = createMockEvent({
			body: { username: 'otheruser', password: 'password123', displayName: 'Other User' }
		});
		await registerPOST(unrelatedRegistration);
		const unrelatedSessionId = unrelatedRegistration._cookieStore.packpal_session;

		const secondLoginEvent = createMockEvent({
			body: { username: 'testuser', password: 'password123' }
		});
		await loginPOST(secondLoginEvent);
		const oldSessionId = secondLoginEvent._cookieStore.packpal_session;

		const response = await mePATCH(
			createMockEvent({
				cookies: { packpal_session: currentSessionId },
				body: {
					currentPassword: 'password123',
					newPassword: 'new-password',
					displayName: 'Updated User'
				}
			})
		);
		const responseBody = await response.json();
		expect(response.status).toBe(200);
		expect(responseBody.user.displayName).toBe('Updated User');

		const currentSession = await meGET(
			createMockEvent({ method: 'GET', cookies: { packpal_session: currentSessionId } })
		);
		const oldSession = await meGET(
			createMockEvent({ method: 'GET', cookies: { packpal_session: oldSessionId } })
		);
		const unrelatedSession = await meGET(
			createMockEvent({ method: 'GET', cookies: { packpal_session: unrelatedSessionId } })
		);
		expect((await currentSession.json()).user.username).toBe('testuser');
		expect((await oldSession.json()).user).toBeNull();
		expect((await unrelatedSession.json()).user.username).toBe('otheruser');

		const oldPasswordLogin = await loginPOST(
			createMockEvent({ body: { username: 'testuser', password: 'password123' } })
		);
		const newPasswordLogin = await loginPOST(
			createMockEvent({ body: { username: 'testuser', password: 'new-password' } })
		);
		expect(oldPasswordLogin.status).toBe(401);
		expect(newPasswordLogin.status).toBe(200);
	});
});
