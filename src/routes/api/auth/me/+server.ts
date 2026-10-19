import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies, hashPassword, verifyPassword } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { sessions, users } from '$lib/server/schema';
import { and, eq, ne } from 'drizzle-orm';
import { sanitizeText } from '$lib/server/utils';
import { readJsonObject } from '$lib/server/request';

const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 1024;

export const GET: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
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
	const sessionId = event.cookies.get('packpal_session');
	const session = await getSessionFromCookies(event);
	if (!session || !sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await readJsonObject(event.request);
	if (!body) return json({ error: 'Invalid request body' }, { status: 400 });

	const { displayName, currentPassword, newPassword } = body;

	if (displayName !== undefined && typeof displayName !== 'string') {
		return json({ error: 'Display name must be a string' }, { status: 400 });
	}
	if (currentPassword !== undefined && typeof currentPassword !== 'string') {
		return json({ error: 'Current password must be a string' }, { status: 400 });
	}
	if (newPassword !== undefined && typeof newPassword !== 'string') {
		return json({ error: 'New password must be a string' }, { status: 400 });
	}
	if (newPassword === '') {
		return json({ error: 'New password is required' }, { status: 400 });
	}
	if (displayName !== undefined && displayName.length > MAX_DISPLAY_NAME_LENGTH) {
		return json({ error: 'Display name must be at most 100 characters' }, { status: 400 });
	}
	if (
		(currentPassword !== undefined && currentPassword.length > MAX_PASSWORD_LENGTH) ||
		(newPassword !== undefined && newPassword.length > MAX_PASSWORD_LENGTH)
	) {
		return json({ error: 'Password must be at most 1024 characters' }, { status: 400 });
	}

	let sanitizedDisplayName: string | undefined;
	if (displayName !== undefined) {
		sanitizedDisplayName = sanitizeText(displayName);
		if (!sanitizedDisplayName) {
			return json({ error: 'Display name cannot be empty' }, { status: 400 });
		}
	}

	const user = await getDb().select().from(users).where(eq(users.id, session.userId)).get();
	if (!user) return json({ error: 'User not found' }, { status: 404 });

	const updates: { displayName?: string; passwordHash?: string } = {};
	if (newPassword !== undefined) {
		if (!currentPassword) {
			return json({ error: 'Current password is required' }, { status: 400 });
		}
		if (!verifyPassword(currentPassword, user.passwordHash)) {
			return json({ error: 'Current password is incorrect' }, { status: 403 });
		}
		if (newPassword.length < 6) {
			return json({ error: 'New password must be at least 6 characters' }, { status: 400 });
		}
		updates.passwordHash = hashPassword(newPassword);
	}

	if (sanitizedDisplayName !== undefined) {
		updates.displayName = sanitizedDisplayName;
	}
	if (Object.keys(updates).length > 0) {
		await getDb().update(users).set(updates).where(eq(users.id, session.userId)).run();

		if (newPassword !== undefined) {
			await getDb()
				.delete(sessions)
				.where(and(eq(sessions.userId, session.userId), ne(sessions.id, sessionId)))
				.run();
		}
	}

	const updated = await getDb().select().from(users).where(eq(users.id, session.userId)).get();
	return json({
		user: {
			id: updated!.id,
			username: updated!.username,
			displayName: updated!.displayName
		}
	});
};
