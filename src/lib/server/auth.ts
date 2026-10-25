import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { dev } from '$app/env';
import { getDb } from '#lib/server/db.js';
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
	if (typeof stored !== 'string' || stored.length !== 161) return false;
	const match = /^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(stored);
	if (!match) return false;
	const [, salt, hash] = match;
	const hashBuffer = Buffer.from(hash, 'hex');
	const derivedKey = scryptSync(password, salt, 64);
	return timingSafeEqual(hashBuffer, derivedKey);
}

export async function createUser(username: string, password: string, displayName: string) {
	const id = generateId();
	const passwordHash = hashPassword(password);
	await getDb()
		.insert(users)
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

export async function createSession(userId: string): Promise<string> {
	const id = generateId();
	const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
	await getDb().insert(sessions).values({ id, userId, expiresAt }).run();
	return id;
}

export async function validateSession(sessionId: string) {
	const result = await getDb()
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

	if (!result || result.expiresAt <= Date.now()) {
		if (result) {
			await getDb().delete(sessions).where(eq(sessions.id, sessionId)).run();
		}
		return null;
	}

	return {
		userId: result.userId,
		username: result.username,
		displayName: result.displayName
	};
}

export async function deleteSession(sessionId: string) {
	await getDb().delete(sessions).where(eq(sessions.id, sessionId)).run();
}

const SESSION_COOKIE = 'packpal_session';

export function setSessionCookie(event: RequestEvent, sessionId: string) {
	event.cookies.set(SESSION_COOKIE, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		// Every production build (Node behind TLS, Cloudflare) serves over HTTPS.
		secure: !dev,
		maxAge: 30 * 24 * 60 * 60 // 30 days
	});
}

export async function getSessionFromCookies(event: RequestEvent) {
	const sessionId = event.cookies.get(SESSION_COOKIE);
	if (!sessionId) return null;
	return validateSession(sessionId);
}

export async function clearSessionCookie(event: RequestEvent) {
	const sessionId = event.cookies.get(SESSION_COOKIE);
	if (sessionId) {
		await deleteSession(sessionId);
	}
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
}
