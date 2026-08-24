import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import path from 'node:path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'packpal.db');

// Ensure data directory exists
import { mkdirSync } from 'node:fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA foreign_keys = ON');

export const db = drizzle({ client: sqlite });

// Run migrations inline (create tables if they don't exist)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    destination TEXT NOT NULL,
    country TEXT,
    start_date INTEGER NOT NULL,
    end_date INTEGER NOT NULL,
    activities TEXT NOT NULL DEFAULT '[]',
    climate TEXT NOT NULL,
    travelers INTEGER NOT NULL,
    notes TEXT,
    archived_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS packing_items (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    packed INTEGER NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    is_custom INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    priority TEXT NOT NULL DEFAULT 'normal'
  );

  CREATE TABLE IF NOT EXISTS trip_collaborators (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE(trip_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS packing_presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    items TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id);
  CREATE INDEX IF NOT EXISTS idx_trips_archived_at ON trips(archived_at);
  CREATE INDEX IF NOT EXISTS idx_packing_items_trip ON packing_items(trip_id);
  CREATE INDEX IF NOT EXISTS idx_packing_items_user ON packing_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_trip_collaborators_trip ON trip_collaborators(trip_id);
  CREATE INDEX IF NOT EXISTS idx_trip_collaborators_user ON trip_collaborators(user_id);
  CREATE INDEX IF NOT EXISTS idx_packing_presets_user ON packing_presets(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_trip ON chat_messages(trip_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
`);

const tripColumns = sqlite.prepare('PRAGMA table_info(trips)').all() as { name: string }[];
if (!tripColumns.some((column) => column.name === 'archived_at')) {
	sqlite.exec('ALTER TABLE trips ADD COLUMN archived_at INTEGER');
}

const packingItemColumns = sqlite.prepare('PRAGMA table_info(packing_items)').all() as {
	name: string;
}[];
if (!packingItemColumns.some((column) => column.name === 'priority')) {
	sqlite.exec("ALTER TABLE packing_items ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'");
}
