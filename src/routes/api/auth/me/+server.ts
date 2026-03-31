import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies, hashPassword, verifyPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { sanitizeText } from '$lib/server/utils';

export const GET: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) {
		return json({ user: null });
	}
	return json({
		user: {
			id: session.userId,
			username: session.username,
			displayName: session.displayName
		}
	});
};

export const PATCH: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await event.request.json();
	const { displayName, currentPassword, newPassword } = body as {
		displayName?: string;
		currentPassword?: string;
		newPassword?: string;
	};

	const user = db.select().from(users).where(eq(users.id, session.userId)).get();
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	if (newPassword) {
		if (!currentPassword) {
			return json({ error: 'Current password is required' }, { status: 400 });
		}
		if (!verifyPassword(currentPassword, user.passwordHash)) {
			return json({ error: 'Current password is incorrect' }, { status: 403 });
		}
		if (newPassword.length < 6) {
			return json({ error: 'New password must be at least 6 characters' }, { status: 400 });
		}
		db.update(users)
			.set({ passwordHash: hashPassword(newPassword) })
			.where(eq(users.id, session.userId))
			.run();
	}

	if (displayName !== undefined) {
		const sanitized = sanitizeText(displayName);
		if (!sanitized) {
			return json({ error: 'Display name cannot be empty' }, { status: 400 });
		}
		db.update(users).set({ displayName: sanitized }).where(eq(users.id, session.userId)).run();
	}

	const updated = db.select().from(users).where(eq(users.id, session.userId)).get();
	return json({
		user: {
			id: updated!.id,
			username: updated!.username,
			displayName: updated!.displayName
		}
	});
};
