import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db.js';

// Deployment readiness: the database is reachable and the schema is applied.
export const GET: RequestHandler = async () => {
	try {
		await getDb().get(sql`SELECT 1 FROM users LIMIT 1`);
	} catch (error) {
		console.error('Readiness check failed', error);
		return json({ status: 'unavailable' }, { status: 503 });
	}
	return json({ status: 'ready' });
};
