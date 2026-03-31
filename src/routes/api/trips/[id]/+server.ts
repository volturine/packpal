import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies } from '$lib/server/auth';
import { getAccessibleTripById } from '$lib/server/trip-access';
import { enrichTrip } from '$lib/server/trip-enrichment';

// GET /api/trips/:id - get a single trip
export const GET: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const { id } = event.params;
	const trip = getAccessibleTripById(session.userId, id);

	if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

	return json(enrichTrip(trip, session.userId));
};
