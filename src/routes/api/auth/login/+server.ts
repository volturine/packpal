import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSession, setSessionCookie, verifyPassword } from '#lib/server/auth.js';
import { getDb } from '#lib/server/db.js';
import { users } from '#lib/server/schema.js';
import { eq } from 'drizzle-orm';
import { rateLimitByIp } from '#lib/server/rate-limit.js';
import { readJsonObject } from '#lib/server/request.js';

const MAX_USERNAME_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 1024;

export const POST: RequestHandler = async (event) => {
	const { allowed, retryAfterMs } = rateLimitByIp(event, 'auth:login', 10, 60_000);
	if (!allowed) {
		return json(
			{ error: 'Too many login attempts. Try again later.' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
		);
	}

	const body = await readJsonObject(event.request);
	if (!body) return json({ error: 'Invalid request body' }, { status: 400 });

	const { username, password } = body;
	if (typeof username !== 'string' || typeof password !== 'string') {
		return json({ error: 'Username and password are required' }, { status: 400 });
	}

	if (!username.trim() || !password) {
		return json({ error: 'Username and password are required' }, { status: 400 });
	}
	if (username.length > MAX_USERNAME_LENGTH) {
		return json({ error: 'Username must be at most 100 characters' }, { status: 400 });
	}
	if (password.length > MAX_PASSWORD_LENGTH) {
		return json({ error: 'Password must be at most 1024 characters' }, { status: 400 });
	}

	const user = await getDb().select().from(users).where(eq(users.username, username.trim())).get();
	if (!user || !verifyPassword(password, user.passwordHash)) {
		return json({ error: 'Invalid username or password' }, { status: 401 });
	}

	const sessionId = await createSession(user.id);
	setSessionCookie(event, sessionId);

	return json({
		user: { id: user.id, username: user.username, displayName: user.displayName }
	});
};
