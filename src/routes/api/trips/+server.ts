import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { chatMessages, packingItems, tripCollaborators, trips, users } from '$lib/server/schema';
import { and, eq } from 'drizzle-orm';
import { getPackingListForTrip, type Climate } from '$lib/data/packing-templates';
import { enrichTrip } from '$lib/server/trip-enrichment';
import { getAccessibleTripById, getAccessibleTrips } from '$lib/server/trip-access';
import { generateId, sanitizeText } from '$lib/server/utils';

// GET /api/trips - list all trips for current user
export const GET: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const sortedTrips = (await getAccessibleTrips(session.userId)).sort(
		(a, b) => b.createdAt - a.createdAt
	);
	const accessibleTrips = await Promise.all(
		sortedTrips.map((trip) => enrichTrip(trip, session.userId))
	);

	return json(accessibleTrips);
};

// POST /api/trips - create a new trip or collaborator/preset action
export const POST: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await event.request.json();

	if (body.action === 'addCollaborator') {
		const { tripId, username } = body as { tripId: string; username: string };
		const trip = await getDb()
			.select()
			.from(trips)
			.where(and(eq(trips.id, tripId), eq(trips.userId, session.userId)))
			.get();
		if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

		const user = await getDb()
			.select()
			.from(users)
			.where(eq(users.username, username.trim()))
			.get();
		if (!user) return json({ error: 'User not found' }, { status: 404 });
		if (user.id === session.userId)
			return json({ error: 'You already own this trip' }, { status: 400 });

		const existing = await getDb()
			.select()
			.from(tripCollaborators)
			.where(and(eq(tripCollaborators.tripId, tripId), eq(tripCollaborators.userId, user.id)))
			.get();
		if (existing) return json({ error: 'Collaborator already added' }, { status: 400 });

		await getDb()
			.insert(tripCollaborators)
			.values({
				id: generateId(),
				tripId,
				userId: user.id,
				invitedByUserId: session.userId,
				createdAt: Date.now()
			})
			.run();

		return json({ ok: true });
	}

	const { name, destination, country, startDate, endDate, activities, climate, travelers, notes } =
		body as {
			name: string;
			destination: string;
			country?: string;
			startDate: number;
			endDate: number;
			activities: string[];
			climate: 'tropical' | 'temperate' | 'cold' | 'arid' | 'mixed';
			travelers: number;
			notes?: string;
		};

	if (!name?.trim() || !destination?.trim() || !startDate || !endDate || !activities?.length) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const id = generateId();
	await getDb()
		.insert(trips)
		.values({
			id,
			userId: session.userId,
			name: sanitizeText(name),
			destination: sanitizeText(destination),
			country: country ? sanitizeText(country) : null,
			startDate,
			endDate,
			activities,
			climate,
			travelers,
			notes: notes ? sanitizeText(notes) : null,
			archivedAt: null,
			createdAt: Date.now()
		})
		.run();

	return json({ id });
};

// PATCH /api/trips - update a trip
export const PATCH: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await event.request.json();
	const { id, action, ...fields } = body as { id: string; action?: string; [key: string]: unknown };

	if (!id) return json({ error: 'Trip ID required' }, { status: 400 });

	const trip = await getAccessibleTripById(session.userId, id);
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	if (action === 'archive') {
		await getDb().update(trips).set({ archivedAt: Date.now() }).where(eq(trips.id, id)).run();
		return json({ ok: true });
	}

	if (action === 'unarchive') {
		await getDb().update(trips).set({ archivedAt: null }).where(eq(trips.id, id)).run();
		return json({ ok: true });
	}

	const updateFields: Record<string, unknown> = {};
	const textFields = ['name', 'destination', 'country', 'notes'];
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined) continue;
		if (textFields.includes(key) && typeof value === 'string') {
			updateFields[key] = sanitizeText(value) || null;
		} else {
			updateFields[key] = value;
		}
	}

	const nextActivities = Array.isArray(fields.activities)
		? (fields.activities as string[])
		: trip.activities;
	const nextClimate = (fields.climate as Climate | undefined) ?? trip.climate;
	const shouldRegeneratePackingList =
		fields.activities !== undefined || fields.climate !== undefined;

	if (Object.keys(updateFields).length > 0) {
		await getDb().update(trips).set(updateFields).where(eq(trips.id, id)).run();
	}

	if (shouldRegeneratePackingList) {
		const generatedItems = getPackingListForTrip(nextActivities, nextClimate);
		const remainingGenerated = new Map(
			generatedItems.map((item) => [item.name.toLowerCase(), item] as const)
		);

		const existingItems = await getDb()
			.select()
			.from(packingItems)
			.where(eq(packingItems.tripId, id))
			.all();

		for (const item of existingItems) {
			if (item.isCustom) continue;

			const generated = remainingGenerated.get(item.name.toLowerCase());
			if (!generated) {
				await getDb().delete(packingItems).where(eq(packingItems.id, item.id)).run();
				continue;
			}

			await getDb()
				.update(packingItems)
				.set({ category: generated.category, quantity: generated.quantity })
				.where(eq(packingItems.id, item.id))
				.run();

			remainingGenerated.delete(item.name.toLowerCase());
		}

		for (const generated of remainingGenerated.values()) {
			await getDb()
				.insert(packingItems)
				.values({
					id: generateId(),
					tripId: id,
					userId: trip.userId,
					name: generated.name,
					category: generated.category,
					quantity: generated.quantity,
					isCustom: false,
					packed: false,
					notes: null,
					priority: 'normal'
				})
				.run();
		}
	}

	return json({ ok: true });
};

// DELETE /api/trips - delete trip or collaborator
export const DELETE: RequestHandler = async (event) => {
	const session = await getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = (await event.request.json()) as { id?: string; collaboratorUserId?: string };

	if (body.id && body.collaboratorUserId) {
		const trip = await getDb()
			.select()
			.from(trips)
			.where(and(eq(trips.id, body.id), eq(trips.userId, session.userId)))
			.get();
		if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

		await getDb()
			.delete(tripCollaborators)
			.where(
				and(
					eq(tripCollaborators.tripId, body.id),
					eq(tripCollaborators.userId, body.collaboratorUserId)
				)
			)
			.run();

		return json({ ok: true });
	}

	const { id } = body;
	if (!id) return json({ error: 'Trip ID required' }, { status: 400 });

	const trip = await getDb()
		.select()
		.from(trips)
		.where(and(eq(trips.id, id), eq(trips.userId, session.userId)))
		.get();
	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	await getDb().delete(chatMessages).where(eq(chatMessages.tripId, id)).run();
	await getDb().delete(packingItems).where(eq(packingItems.tripId, id)).run();
	await getDb().delete(tripCollaborators).where(eq(tripCollaborators.tripId, id)).run();
	await getDb().delete(trips).where(eq(trips.id, id)).run();

	return json({ ok: true });
};
