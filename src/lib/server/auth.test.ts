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
	hashPassword,
	verifyPassword,
	createUser,
	createSession,
	validateSession,
	deleteSession
} from '$lib/server/auth';
import { clearAllTables } from './test-db-helpers';

beforeEach(() => {
	if (helpers.sqliteRef) {
		clearAllTables(helpers.sqliteRef);
	}
});

describe('hashPassword', () => {
	it('returns a string in salt:hash format', () => {
		const result = hashPassword('mypassword');
		expect(result).toContain(':');
		const parts = result.split(':');
		expect(parts).toHaveLength(2);
		expect(parts[0].length).toBeGreaterThan(0); // salt
		expect(parts[1].length).toBeGreaterThan(0); // hash
	});

	it('generates different salts for same password', () => {
		const hash1 = hashPassword('mypassword');
		const hash2 = hashPassword('mypassword');
		expect(hash1).not.toBe(hash2);
	});

	it('generates hex-encoded output', () => {
		const result = hashPassword('test');
		const [salt, hash] = result.split(':');
		expect(salt).toMatch(/^[a-f0-9]+$/);
		expect(hash).toMatch(/^[a-f0-9]+$/);
	});
});

describe('verifyPassword', () => {
	it('returns true for correct password', () => {
		const stored = hashPassword('correctpassword');
		expect(verifyPassword('correctpassword', stored)).toBe(true);
	});

	it('returns false for wrong password', () => {
		const stored = hashPassword('correctpassword');
		expect(verifyPassword('wrongpassword', stored)).toBe(false);
	});

	it('handles various password characters', () => {
		const passwords = ['simple', 'with spaces', 'spëcial-chars!@#$%^&*()', '日本語', ''];
		for (const pw of passwords) {
			const stored = hashPassword(pw);
			expect(verifyPassword(pw, stored)).toBe(true);
			if (pw !== '') {
				expect(verifyPassword(pw + 'x', stored)).toBe(false);
			}
		}
	});
});

describe('createUser', () => {
	it('creates a user and returns correct shape', () => {
		const user = createUser('testuser', 'password123', 'Test User');
		expect(user).toHaveProperty('id');
		expect(user.username).toBe('testuser');
		expect(user.displayName).toBe('Test User');
		expect(typeof user.id).toBe('string');
		expect(user.id.length).toBeGreaterThan(0);
	});

	it('creates users with unique IDs', () => {
		const user1 = createUser('user1', 'pass1', 'User One');
		const user2 = createUser('user2', 'pass2', 'User Two');
		expect(user1.id).not.toBe(user2.id);
	});

	it('stores password hash (not plaintext)', () => {
		createUser('testuser', 'secretpass', 'Test');
		const row = helpers
			.sqliteRef!.prepare('SELECT password_hash FROM users WHERE username = ?')
			.get('testuser') as { password_hash: string };
		expect(row.password_hash).not.toBe('secretpass');
		expect(row.password_hash).toContain(':');
	});
});

describe('createSession', () => {
	it('creates a session and returns session ID', () => {
		const user = createUser('testuser', 'pass', 'Test');
		const sessionId = createSession(user.id);
		expect(typeof sessionId).toBe('string');
		expect(sessionId.length).toBeGreaterThan(0);
	});

	it('creates sessions with future expiry', () => {
		const user = createUser('testuser', 'pass', 'Test');
		const sessionId = createSession(user.id);
		const row = helpers
			.sqliteRef!.prepare('SELECT expires_at FROM sessions WHERE id = ?')
			.get(sessionId) as { expires_at: number };
		expect(row.expires_at).toBeGreaterThan(Date.now());
	});
});

describe('validateSession', () => {
	it('returns user data for valid session', () => {
		const user = createUser('testuser', 'pass', 'Test User');
		const sessionId = createSession(user.id);
		const result = validateSession(sessionId);
		expect(result).not.toBeNull();
		expect(result!.userId).toBe(user.id);
		expect(result!.username).toBe('testuser');
		expect(result!.displayName).toBe('Test User');
	});

	it('returns null for non-existent session', () => {
		expect(validateSession('nonexistent')).toBeNull();
	});

	it('returns null and deletes expired session', () => {
		const user = createUser('testuser', 'pass', 'Test');
		const sessionId = createSession(user.id);

		// Manually expire the session
		helpers
			.sqliteRef!.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
			.run(Date.now() - 1000, sessionId);

		const result = validateSession(sessionId);
		expect(result).toBeNull();

		// Session should be deleted
		const row = helpers.sqliteRef!.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
		expect(row).toBeUndefined();
	});
});

describe('deleteSession', () => {
	it('removes the session from the database', () => {
		const user = createUser('testuser', 'pass', 'Test');
		const sessionId = createSession(user.id);

		deleteSession(sessionId);

		const row = helpers.sqliteRef!.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
		expect(row).toBeUndefined();
	});

	it('does not throw for non-existent session', () => {
		expect(() => deleteSession('nonexistent')).not.toThrow();
	});
});
