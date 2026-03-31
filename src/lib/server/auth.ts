import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { sessions, users } from './schema';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { generateId } from './utils';

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(':');
	const hashBuffer = Buffer.from(hash, 'hex');
	const derivedKey = scryptSync(password, salt, 64);
	return timingSafeEqual(hashBuffer, derivedKey);
}

export function createUser(username: string, password: string, displayName: string) {
	const id = generateId();
	const passwordHash = hashPassword(password);
	db.insert(users)
		.values({
			id,
			username,
			passwordHash,
			displayName,
			createdAt: Date.now()
		})
		.run();
	return { id, username, displayName };
}

export function createSession(userId: string): string {
	const id = generateId();
	const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
	db.insert(sessions).values({ id, userId, expiresAt }).run();
	return id;
}

export function validateSession(sessionId: string) {
	const result = db
		.select({
			sessionId: sessions.id,
			userId: sessions.userId,
			expiresAt: sessions.expiresAt,
			username: users.username,
			displayName: users.displayName
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId))
		.get();

	if (!result || result.expiresAt < Date.now()) {
		if (result) {
			db.delete(sessions).where(eq(sessions.id, sessionId)).run();
		}
		return null;
	}

	return {
		userId: result.userId,
		username: result.username,
		displayName: result.displayName
	};
}

export function deleteSession(sessionId: string) {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

const SESSION_COOKIE = 'packpal_session';

export function setSessionCookie(event: RequestEvent, sessionId: string) {
	event.cookies.set(SESSION_COOKIE, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 30 * 24 * 60 * 60 // 30 days
	});
}

export function getSessionFromCookies(event: RequestEvent) {
	const sessionId = event.cookies.get(SESSION_COOKIE);
	if (!sessionId) return null;
	return validateSession(sessionId);
}

export function clearSessionCookie(event: RequestEvent) {
	const sessionId = event.cookies.get(SESSION_COOKIE);
	if (sessionId) {
		deleteSession(sessionId);
	}
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
}
