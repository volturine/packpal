import { getRequestEvent } from '$app/server';
import { drizzle } from 'drizzle-orm/d1';
import type { Db } from '../db-types';

// Cloudflare Workers runtime. Replaces $lib/server/db when DEPLOY_TARGET=cloudflare.
export function getDb(): Db {
	const binding = getRequestEvent().platform?.env.PACKPAL_DB;
	if (!binding) throw new Error('PACKPAL_DB binding is unavailable');
	return drizzle(binding);
}
