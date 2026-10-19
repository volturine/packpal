import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { chatMessages } from '$lib/server/schema';
import { and, eq, lt, desc } from 'drizzle-orm';
import { getAccessibleTripById } from '$lib/server/trip-access';
import { generateId } from '$lib/server/utils';
import { readJsonObject } from '$lib/server/request';

const PAGE_SIZE = 50;

// GET /api/chat-messages?tripId=xxx&before=timestamp&limit=50
export const GET: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const tripId = event.url.searchParams.get('tripId');
	if (!tripId) return json({ error: 'tripId required' }, { status: 400 });

	const trip = await getAccessibleTripById(session.userId, tripId);
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	const beforeParam = event.url.searchParams.get('before');
	const limitParam = event.url.searchParams.get('limit');
	const before = beforeParam === null ? null : Number(beforeParam);
	const limit = limitParam === null ? PAGE_SIZE : Number(limitParam);
	if (
		!Number.isSafeInteger(limit) ||
		limit < 1 ||
		limit > 100 ||
		(limitParam !== null && !limitParam.trim()) ||
		(before !== null && (!beforeParam?.trim() || !Number.isSafeInteger(before) || before < 0))
	) {
		return json({ error: 'Invalid pagination parameters' }, { status: 400 });
	}

	const conditions = [eq(chatMessages.tripId, tripId)];
	if (before !== null) {
		conditions.push(lt(chatMessages.createdAt, before));
	}

	const messages = await getDb()
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
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await readJsonObject(event.request, 65_536);
	if (!body) return json({ error: 'Invalid or oversized message request' }, { status: 400 });
	const { tripId, role, content } = body;

	if (
		typeof tripId !== 'string' ||
		!tripId.trim() ||
		tripId.length > 128 ||
		(role !== 'user' && role !== 'assistant') ||
		typeof content !== 'string' ||
		!content.trim() ||
		content.length > 16_384
	) {
		return json({ error: 'Valid tripId, role, and content required' }, { status: 400 });
	}

	const trip = await getAccessibleTripById(session.userId, tripId);
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	const id = generateId();
	await getDb()
		.insert(chatMessages)
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
