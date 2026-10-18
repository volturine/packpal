import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Db } from './db-types';
import { applyMigrations, createSqliteDb } from './sqlite';

// Node runtime (adapter-node, Docker). The Cloudflare build swaps this module
// for ./cloudflare/db.ts; see vite.config.ts.
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'packpal.db');

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
applyMigrations(sqlite);

const db = createSqliteDb(sqlite);

export function getDb(): Db {
	return db;
}
