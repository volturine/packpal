import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSession, setSessionCookie, verifyPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async (event) => {
	const body = await event.request.json();
	const { username, password } = body as { username: string; password: string };

	if (!username?.trim() || !password) {
		return json({ error: 'Username and password are required' }, { status: 400 });
	}

	const user = db.select().from(users).where(eq(users.username, username.trim())).get();
	if (!user || !verifyPassword(password, user.passwordHash)) {
		return json({ error: 'Invalid username or password' }, { status: 401 });
	}

	const sessionId = createSession(user.id);
	setSessionCookie(event, sessionId);

	return json({
		user: { id: user.id, username: user.username, displayName: user.displayName }
	});
};
