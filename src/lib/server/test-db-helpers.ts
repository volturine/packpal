/**
 * Shared test database helpers for integration tests.
 * Uses better-sqlite3 in-memory databases for test isolation.
 */

export const TEST_DDL = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE trips (
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

  CREATE TABLE packing_items (
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

  CREATE TABLE trip_collaborators (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE(trip_id, user_id)
  );

  CREATE TABLE packing_presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    items TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
  );

  CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id);
  CREATE INDEX IF NOT EXISTS idx_packing_items_trip ON packing_items(trip_id);
  CREATE INDEX IF NOT EXISTS idx_trip_collaborators_trip ON trip_collaborators(trip_id);
  CREATE INDEX IF NOT EXISTS idx_trip_collaborators_user ON trip_collaborators(user_id);
  CREATE INDEX IF NOT EXISTS idx_packing_presets_user ON packing_presets(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_trip ON chat_messages(trip_id);
`;

export function clearAllTables(sqlite: { exec: (sql: string) => void }) {
	sqlite.exec('DELETE FROM chat_messages');
	sqlite.exec('DELETE FROM packing_items');
	sqlite.exec('DELETE FROM trip_collaborators');
	sqlite.exec('DELETE FROM packing_presets');
	sqlite.exec('DELETE FROM sessions');
	sqlite.exec('DELETE FROM trips');
	sqlite.exec('DELETE FROM users');
}

/** Insert a test user directly into the DB */
export function insertTestUser(
	sqlite: { exec: (sql: string) => void },
	opts: {
		id: string;
		username: string;
		passwordHash?: string;
		displayName: string;
		createdAt?: number;
	}
) {
	const hash = opts.passwordHash ?? 'fakesalt:fakehash';
	const createdAt = opts.createdAt ?? Date.now();
	sqlite.exec(
		`INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES ('${opts.id}', '${opts.username}', '${hash}', '${opts.displayName}', ${createdAt})`
	);
}

/** Insert a test trip directly into the DB */
export function insertTestTrip(
	sqlite: { exec: (sql: string) => void },
	opts: {
		id: string;
		userId: string;
		name: string;
		destination: string;
		country?: string;
		startDate: number;
		endDate: number;
		activities?: string[];
		climate?: string;
		travelers?: number;
		notes?: string;
		archivedAt?: number | null;
		createdAt?: number;
	}
) {
	const activities = JSON.stringify(opts.activities ?? ['hiking']);
	const climate = opts.climate ?? 'temperate';
	const travelers = opts.travelers ?? 1;
	const country = opts.country ? `'${opts.country}'` : 'NULL';
	const notes = opts.notes ? `'${opts.notes}'` : 'NULL';
	const archivedAt = opts.archivedAt != null ? opts.archivedAt : 'NULL';
	const createdAt = opts.createdAt ?? Date.now();
	sqlite.exec(
		`INSERT INTO trips (id, user_id, name, destination, country, start_date, end_date, activities, climate, travelers, notes, archived_at, created_at)
     VALUES ('${opts.id}', '${opts.userId}', '${opts.name}', '${opts.destination}', ${country}, ${opts.startDate}, ${opts.endDate}, '${activities}', '${climate}', ${travelers}, ${notes}, ${archivedAt}, ${createdAt})`
	);
}

/** Insert a test packing item directly into the DB */
export function insertTestPackingItem(
	sqlite: { exec: (sql: string) => void },
	opts: {
		id: string;
		tripId: string;
		userId: string;
		name: string;
		category: string;
		packed?: boolean;
		quantity?: number;
		isCustom?: boolean;
		notes?: string;
		priority?: string;
	}
) {
	const packed = opts.packed ? 1 : 0;
	const quantity = opts.quantity ?? 1;
	const isCustom = opts.isCustom ? 1 : 0;
	const notes = opts.notes ? `'${opts.notes}'` : 'NULL';
	const priority = opts.priority ?? 'normal';
	sqlite.exec(
		`INSERT INTO packing_items (id, trip_id, user_id, name, category, packed, quantity, is_custom, notes, priority)
     VALUES ('${opts.id}', '${opts.tripId}', '${opts.userId}', '${opts.name}', '${opts.category}', ${packed}, ${quantity}, ${isCustom}, ${notes}, '${priority}')`
	);
}

/** Insert a test collaborator directly into the DB */
export function insertTestCollaborator(
	sqlite: { exec: (sql: string) => void },
	opts: {
		id: string;
		tripId: string;
		userId: string;
		invitedByUserId: string;
		createdAt?: number;
	}
) {
	const createdAt = opts.createdAt ?? Date.now();
	sqlite.exec(
		`INSERT INTO trip_collaborators (id, trip_id, user_id, invited_by_user_id, created_at)
     VALUES ('${opts.id}', '${opts.tripId}', '${opts.userId}', '${opts.invitedByUserId}', ${createdAt})`
	);
}
