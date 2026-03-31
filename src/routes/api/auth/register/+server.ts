import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUser, createSession, setSessionCookie } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async (event) => {
	const body = await event.request.json();
	const { username, password, displayName } = body as {
		username: string;
		password: string;
		displayName: string;
	};

	if (!username?.trim() || !password || !displayName?.trim()) {
		return json({ error: 'Username, password, and display name are required' }, { status: 400 });
	}

	if (username.trim().length < 3) {
		return json({ error: 'Username must be at least 3 characters' }, { status: 400 });
	}

	if (password.length < 6) {
		return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
	}

	const existing = db.select().from(users).where(eq(users.username, username.trim())).get();
	if (existing) {
		return json({ error: 'Username already taken' }, { status: 409 });
	}

	const user = createUser(username.trim(), password, displayName.trim());
	const sessionId = createSession(user.id);
	setSessionCookie(event, sessionId);

	return json({ user: { id: user.id, username: user.username, displayName: user.displayName } });
};
