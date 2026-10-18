import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';

const helpers = vi.hoisted(() => ({ sqliteRef: null as InstanceType<typeof Database> | null }));

vi.mock('$lib/server/db', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { applyMigrations, createSqliteDb } = await import('$lib/server/sqlite');

	const sqlite = new Database(':memory:');
	applyMigrations(sqlite);
	helpers.sqliteRef = sqlite;

	return { getDb: () => createSqliteDb(sqlite) };
});

import { GET } from './+server';

const event = {} as Parameters<typeof GET>[0];

describe('GET /health/ready', () => {
	it('reports ready when the schema is reachable', async () => {
		const response = await GET(event);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'ready' });
	});

	it('reports unavailable when the schema is missing', async () => {
		helpers.sqliteRef!.exec('DROP TABLE users');
		const response = await GET(event);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ status: 'unavailable' });
	});
});
