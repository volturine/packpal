import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUser, createSession, setSessionCookie } from '#lib/server/auth.js';
import { getDb } from '#lib/server/db.js';
import { users } from '#lib/server/schema.js';
import { eq } from 'drizzle-orm';
import { rateLimitByIp } from '#lib/server/rate-limit.js';
import { sanitizeText } from '#lib/server/utils.js';
import { readJsonObject } from '#lib/server/request.js';

const MAX_USERNAME_LENGTH = 100;
const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 1024;

export const POST: RequestHandler = async (event) => {
	const { allowed, retryAfterMs } = rateLimitByIp(event, 'auth:register', 5, 60_000);
	if (!allowed) {
		return json(
			{ error: 'Too many registration attempts. Try again later.' },
			{ status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
		);
	}

	const body = await readJsonObject(event.request);
	if (!body) return json({ error: 'Invalid request body' }, { status: 400 });

	const { username, password, displayName } = body;
	if (
		typeof username !== 'string' ||
		typeof password !== 'string' ||
		typeof displayName !== 'string'
	) {
		return json({ error: 'Username, password, and display name are required' }, { status: 400 });
	}

	if (!username.trim() || !password || !displayName.trim()) {
		return json({ error: 'Username, password, and display name are required' }, { status: 400 });
	}
	if (username.length > MAX_USERNAME_LENGTH) {
		return json({ error: 'Username must be at most 100 characters' }, { status: 400 });
	}
	if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
		return json({ error: 'Display name must be at most 100 characters' }, { status: 400 });
	}
	if (password.length > MAX_PASSWORD_LENGTH) {
		return json({ error: 'Password must be at most 1024 characters' }, { status: 400 });
	}

	const sanitizedUsername = sanitizeText(username);
	const sanitizedDisplayName = sanitizeText(displayName);
	if (!sanitizedDisplayName) {
		return json({ error: 'Display name cannot be empty' }, { status: 400 });
	}

	if (sanitizedUsername.length < 3) {
		return json({ error: 'Username must be at least 3 characters' }, { status: 400 });
	}

	if (password.length < 6) {
		return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
	}

	const existing = await getDb()
		.select()
		.from(users)
		.where(eq(users.username, sanitizedUsername))
		.get();
	if (existing) {
		return json({ error: 'Username already taken' }, { status: 409 });
	}

	const user = await createUser(sanitizedUsername, password, sanitizedDisplayName);
	const sessionId = await createSession(user.id);
	setSessionCookie(event, sessionId);

	return json({ user: { id: user.id, username: user.username, displayName: user.displayName } });
};
