import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { applyMigrations } from './sqlite';

describe('applyMigrations', () => {
	it('creates the schema and records each migration once', () => {
		const sqlite = new Database(':memory:');
		applyMigrations(sqlite);
		applyMigrations(sqlite);

		const tables = sqlite
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
			.pluck()
			.all();
		expect(tables).toEqual([
			'chat_messages',
			'packing_items',
			'packing_presets',
			'schema_migrations',
			'sessions',
			'trip_collaborators',
			'trips',
			'users'
		]);

		const applied = sqlite
			.prepare('SELECT name FROM schema_migrations ORDER BY name')
			.pluck()
			.all();
		expect(applied).toEqual(['0001_initial.sql']);
	});

	it('is a no-op for databases created before migrations were tracked', () => {
		const sqlite = new Database(':memory:');
		sqlite.exec(
			'CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, created_at INTEGER NOT NULL)'
		);
		sqlite.exec("INSERT INTO users VALUES ('u1', 'ann', 'salt:hash', 'Ann', 1)");

		applyMigrations(sqlite);

		expect(sqlite.prepare('SELECT count(*) FROM users').pluck().get()).toBe(1);
		expect(sqlite.prepare('SELECT count(*) FROM trips').pluck().get()).toBe(0);
	});
});
