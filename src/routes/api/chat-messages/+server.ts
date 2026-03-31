import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { chatMessages } from '$lib/server/schema';
import { and, eq, lt, desc } from 'drizzle-orm';
import { getAccessibleTripById } from '$lib/server/trip-access';
import { generateId } from '$lib/server/utils';

const PAGE_SIZE = 50;

// GET /api/chat-messages?tripId=xxx&before=timestamp&limit=50
export const GET: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const tripId = event.url.searchParams.get('tripId');
	if (!tripId) return json({ error: 'tripId required' }, { status: 400 });

	const trip = getAccessibleTripById(session.userId, tripId);
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	const before = event.url.searchParams.get('before');
	const limit = Math.min(Number(event.url.searchParams.get('limit')) || PAGE_SIZE, 100);

	const conditions = [eq(chatMessages.tripId, tripId)];
	if (before) {
		conditions.push(lt(chatMessages.createdAt, Number(before)));
	}

	const messages = db
		.select()
		.from(chatMessages)
		.where(and(...conditions))
		.orderBy(desc(chatMessages.createdAt))
		.limit(limit + 1)
		.all();

	const hasMore = messages.length > limit;
	const page = hasMore ? messages.slice(0, limit) : messages;

	return json({ messages: page.reverse(), hasMore });
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
