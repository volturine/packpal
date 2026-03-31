import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { packingItems } from '$lib/server/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { getAccessibleTripById } from '$lib/server/trip-access';
import { generateId, sanitizeText } from '$lib/server/utils';

// GET /api/packing-items?tripId=xxx
export const GET: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const tripId = event.url.searchParams.get('tripId');
	if (!tripId) return json({ error: 'tripId required' }, { status: 400 });

	const trip = getAccessibleTripById(session.userId, tripId);
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	const items = db.select().from(packingItems).where(eq(packingItems.tripId, tripId)).all();
	return json(items);
};

// POST /api/packing-items - bulk create or single add
export const POST: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await event.request.json();
	const { tripId, items, item } = body as {
		tripId: string;
		items?: {
			name: string;
			category: string;
			quantity: number;
			isCustom: boolean;
			notes?: string;
			priority?: 'must' | 'normal' | 'optional';
		}[];
		item?: {
			name: string;
			category: string;
			quantity: number;
			notes?: string;
			priority?: 'must' | 'normal' | 'optional';
		};
	};

	if (!tripId) return json({ error: 'tripId required' }, { status: 400 });

	const trip = getAccessibleTripById(session.userId, tripId);
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	if (items) {
		const ids: string[] = [];
		for (const currentItem of items) {
			const id = generateId();
			db.insert(packingItems)
				.values({
					id,
					tripId,
					userId: session.userId,
					name: sanitizeText(currentItem.name),
					category: currentItem.category,
					quantity: currentItem.quantity,
					isCustom: currentItem.isCustom,
					packed: false,
					notes: currentItem.notes ? sanitizeText(currentItem.notes) : null,
					priority: currentItem.priority ?? 'normal'
				})
				.run();
			ids.push(id);
		}
		return json({ ids });
	}

	if (item) {
		const id = generateId();
		db.insert(packingItems)
			.values({
				id,
				tripId,
				userId: session.userId,
				name: sanitizeText(item.name),
				category: item.category,
				quantity: item.quantity,
				isCustom: true,
				packed: false,
				notes: item.notes ? sanitizeText(item.notes) : null,
				priority: item.priority ?? 'normal'
			})
			.run();
		return json({ id });
	}

	return json({ error: 'items or item required' }, { status: 400 });
};

// PATCH /api/packing-items - toggle, update, toggleAll, or toggleTrip
export const PATCH: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await event.request.json();
	const { action } = body as { action: string };

	if (action === 'toggle') {
		const { id } = body as { id: string };
		const item = db.select().from(packingItems).where(eq(packingItems.id, id)).get();
		if (!item) return json({ error: 'Item not found' }, { status: 404 });

		const trip = getAccessibleTripById(session.userId, item.tripId);
		if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

		db.update(packingItems).set({ packed: !item.packed }).where(eq(packingItems.id, id)).run();
		return json({ ok: true, packed: !item.packed });
	}

	if (action === 'update') {
		const { id, name, category, quantity, notes, priority } = body as {
			id: string;
			name?: string;
			category?: string;
			quantity?: number;
			notes?: string | null;
			priority?: 'must' | 'normal' | 'optional';
		};
		const item = db.select().from(packingItems).where(eq(packingItems.id, id)).get();
		if (!item) return json({ error: 'Item not found' }, { status: 404 });

		const trip = getAccessibleTripById(session.userId, item.tripId);
		if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

		const updateFields: Record<string, unknown> = {};
		if (name !== undefined) updateFields.name = sanitizeText(name);
		if (category !== undefined) updateFields.category = category;
		if (quantity !== undefined) updateFields.quantity = quantity;
		if (notes !== undefined) updateFields.notes = notes ? sanitizeText(notes) : null;
		if (priority !== undefined) updateFields.priority = priority;

		if (Object.keys(updateFields).length > 0) {
			db.update(packingItems).set(updateFields).where(eq(packingItems.id, id)).run();
		}
		return json({ ok: true });
	}

	if (action === 'toggleAll') {
		const { tripId, category, packed, filteredItemIds } = body as {
			tripId: string;
			category?: string;
			packed: boolean;
			filteredItemIds?: string[];
		};
		const trip = getAccessibleTripById(session.userId, tripId);
		if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

		const conditions = [eq(packingItems.tripId, tripId)];
		if (category) conditions.push(eq(packingItems.category, category));
		if (filteredItemIds?.length) conditions.push(inArray(packingItems.id, filteredItemIds));

		db.update(packingItems)
			.set({ packed })
			.where(and(...conditions))
			.run();
		return json({ ok: true });
	}

	if (action === 'toggleTrip') {
		const { tripId, packed, filteredItemIds } = body as {
			tripId: string;
			packed: boolean;
			filteredItemIds?: string[];
		};

		const trip = getAccessibleTripById(session.userId, tripId);
		if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

		const conditions = [eq(packingItems.tripId, tripId)];
		if (filteredItemIds?.length) conditions.push(inArray(packingItems.id, filteredItemIds));

		db.update(packingItems)
			.set({ packed })
			.where(and(...conditions))
			.run();

		return json({ ok: true });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};

// DELETE /api/packing-items
export const DELETE: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = (await event.request.json()) as { id: string };
	if (!id) return json({ error: 'Item ID required' }, { status: 400 });

	const item = db.select().from(packingItems).where(eq(packingItems.id, id)).get();
	if (!item) return json({ error: 'Item not found' }, { status: 404 });

	const trip = getAccessibleTripById(session.userId, item.tripId);
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	db.delete(packingItems).where(eq(packingItems.id, id)).run();
	return json({ ok: true });
};
