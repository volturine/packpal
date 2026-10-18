import type { Database } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { Db } from './db-types';

// The same files `wrangler d1 migrations apply` runs on Cloudflare.
const migrations = import.meta.glob('/cf/migrations/*.sql', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

/** Apply every migration from cf/migrations/ that this database has not recorded yet. */
export function applyMigrations(sqlite: Database) {
	sqlite.exec(
		'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'
	);
	const applied = new Set(
		sqlite.prepare('SELECT name FROM schema_migrations').pluck().all() as string[]
	);
	const record = sqlite.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
	for (const file of Object.keys(migrations).sort()) {
		const name = file.slice(file.lastIndexOf('/') + 1);
		if (applied.has(name)) continue;
		sqlite.transaction(() => {
			sqlite.exec(migrations[file]);
			record.run(name, Date.now());
		})();
	}
}

/** Wrap an open better-sqlite3 connection in the asynchronous drizzle client the app uses. */
export function createSqliteDb(sqlite: Database): Db {
	return drizzle(async (sql, params, method) => {
		const statement = sqlite.prepare(sql);
		if (method === 'run') {
			statement.run(...params);
			return { rows: [] };
		}
		if (method === 'get') {
			// A miss yields undefined, which drizzle maps to "no row"; an empty array would map to a row of nulls.
			return { rows: statement.raw().get(...params) as unknown[] };
		}
		return { rows: statement.raw().all(...params) as unknown[][] };
	});
}
