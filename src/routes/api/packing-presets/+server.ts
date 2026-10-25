import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies } from '#lib/server/auth.js';
import { getDb } from '#lib/server/db.js';
import { packingItems, packingPresets } from '#lib/server/schema.js';
import { desc, eq } from 'drizzle-orm';
import { getAccessibleTripById } from '#lib/server/trip-access.js';
import { generateId, sanitizeText } from '#lib/server/utils.js';

export const GET: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const presets = await getDb()
		.select()
		.from(packingPresets)
		.where(eq(packingPresets.userId, session.userId))
		.orderBy(desc(packingPresets.lastUsedAt), desc(packingPresets.createdAt))
		.all();

	return json(presets);
};

export const POST: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await event.request.json();

	if (body.action === 'saveFromTrip') {
		const { tripId, name } = body as { tripId: string; name: string };
		const trip = await getAccessibleTripById(session.userId, tripId);
		if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

		const items = await getDb()
			.select({
				name: packingItems.name,
				category: packingItems.category,
				quantity: packingItems.quantity,
				notes: packingItems.notes,
				priority: packingItems.priority
			})
			.from(packingItems)
			.where(eq(packingItems.tripId, tripId))
			.all();

		const presetId = generateId();
		await getDb()
			.insert(packingPresets)
			.values({
				id: presetId,
				userId: session.userId,
				name: sanitizeText(name) || `${trip.name} preset`,
				items,
				createdAt: Date.now(),
				lastUsedAt: null
			})
			.run();

		return json({ id: presetId });
	}

	const { name, items } = body as {
		name: string;
		items: {
			name: string;
			category: string;
			quantity: number;
			notes: string | null;
			priority: 'must' | 'normal' | 'optional';
		}[];
	};

	if (!name?.trim() || !items?.length) {
		return json({ error: 'Preset name and items required' }, { status: 400 });
	}

	const id = generateId();
	await getDb()
		.insert(packingPresets)
		.values({
			id,
			userId: session.userId,
			name: sanitizeText(name),
			items,
			createdAt: Date.now(),
			lastUsedAt: null
		})
		.run();

	return json({ id });
};

export const PATCH: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const { id, action } = (await event.request.json()) as { id: string; action?: string };
	if (!id) return json({ error: 'Preset ID required' }, { status: 400 });

	const preset = await getDb().select().from(packingPresets).where(eq(packingPresets.id, id)).get();
	if (!preset || preset.userId !== session.userId) {
		return json({ error: 'Preset not found' }, { status: 404 });
	}

	if (action === 'markUsed') {
		await getDb()
			.update(packingPresets)
			.set({ lastUsedAt: Date.now() })
			.where(eq(packingPresets.id, id))
			.run();
		return json({ ok: true });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};

export const DELETE: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = (await event.request.json()) as { id: string };
	if (!id) return json({ error: 'Preset ID required' }, { status: 400 });

	const preset = await getDb().select().from(packingPresets).where(eq(packingPresets.id, id)).get();
	if (!preset || preset.userId !== session.userId) {
		return json({ error: 'Preset not found' }, { status: 404 });
	}

	await getDb().delete(packingPresets).where(eq(packingPresets.id, id)).run();
	return json({ ok: true });
};
