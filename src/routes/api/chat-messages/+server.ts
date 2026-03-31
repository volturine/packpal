import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { chatMessages } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { getAccessibleTripById } from '$lib/server/trip-access';

function generateId(): string {
	return randomBytes(16).toString('hex');
}

// GET /api/chat-messages?tripId=xxx
export const GET: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const tripId = event.url.searchParams.get('tripId');
	if (!tripId) return json({ error: 'tripId required' }, { status: 400 });

	const trip = getAccessibleTripById(session.userId, tripId);
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	const messages = db.select().from(chatMessages).where(eq(chatMessages.tripId, tripId)).all();
	return json(messages);
};

// POST /api/chat-messages - add a message
export const POST: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await event.request.json();
	const { tripId, role, content } = body as {
		tripId: string;
		role: 'user' | 'assistant';
		content: string;
	};

	if (!tripId || !role || !content) {
		return json({ error: 'tripId, role, and content required' }, { status: 400 });
	}

	const trip = getAccessibleTripById(session.userId, tripId);
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	const id = generateId();
	db.insert(chatMessages)
		.values({
			id,
			tripId,
			userId: session.userId,
			role,
			content,
			createdAt: Date.now()
		})
		.run();

	return json({ id });
};
