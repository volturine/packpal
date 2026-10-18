import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/**
 * The drizzle client every server module queries through. Both runtimes are
 * asynchronous (D1 on Cloudflare, better-sqlite3 behind drizzle's proxy driver
 * on Node), so a forgotten `await` is a type error instead of a Workers-only bug.
 */
export type Db = BaseSQLiteDatabase<'async', unknown>;
