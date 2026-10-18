/**
 * Shared test database helpers for integration tests.
 * Uses better-sqlite3 in-memory databases for test isolation. The schema is
 * applied from cf/migrations via applyMigrations (src/lib/server/sqlite.ts).
 */

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
