import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { tripCollaborators, trips, users } from '$lib/server/schema';

export interface AccessibleTripRecord {
	id: string;
	userId: string;
	name: string;
	destination: string;
	country: string | null;
	startDate: number;
	endDate: number;
	activities: string[];
	climate: 'tropical' | 'temperate' | 'cold' | 'arid' | 'mixed';
	travelers: number;
	notes: string | null;
	archivedAt: number | null;
	createdAt: number;
	ownerDisplayName: string;
	ownerUsername: string;
	isShared: boolean;
}

function getTripsWithOwners(where?: { ids?: string[] }) {
	const baseQuery = getDb()
		.select({
			id: trips.id,
			userId: trips.userId,
			name: trips.name,
			destination: trips.destination,
			country: trips.country,
			startDate: trips.startDate,
			endDate: trips.endDate,
			activities: trips.activities,
			climate: trips.climate,
			travelers: trips.travelers,
			notes: trips.notes,
			archivedAt: trips.archivedAt,
			createdAt: trips.createdAt,
			ownerDisplayName: users.displayName,
			ownerUsername: users.username
		})
		.from(trips)
		.innerJoin(users, eq(users.id, trips.userId));

	if (where?.ids && where.ids.length > 0) {
		return baseQuery.where(inArray(trips.id, where.ids)).all();
	}

	return baseQuery.all();
}

export async function getAccessibleTripIds(userId: string) {
	const owned = await getDb()
		.select({ id: trips.id })
		.from(trips)
		.where(eq(trips.userId, userId))
		.all();

	const shared = await getDb()
		.select({ tripId: tripCollaborators.tripId })
		.from(tripCollaborators)
		.where(eq(tripCollaborators.userId, userId))
		.all();

	return [...new Set([...owned.map((trip) => trip.id), ...shared.map((row) => row.tripId)])];
}

export async function getAccessibleTrips(userId: string): Promise<AccessibleTripRecord[]> {
	const accessibleIds = await getAccessibleTripIds(userId);
	if (accessibleIds.length === 0) return [];

	const accessibleTrips = await getTripsWithOwners({ ids: accessibleIds });
	return accessibleTrips.map((trip) => ({
		...trip,
		isShared: trip.userId !== userId
	}));
}

export async function getAccessibleTripById(userId: string, tripId: string) {
	const [trip] = await getTripsWithOwners({ ids: [tripId] });
	if (!trip) return null;

	const isOwner = trip.userId === userId;
	if (isOwner) return { ...trip, isShared: false };

	const collaboration = await getDb()
		.select({ id: tripCollaborators.id })
		.from(tripCollaborators)
		.where(and(eq(tripCollaborators.tripId, tripId), eq(tripCollaborators.userId, userId)))
		.get();

	if (!collaboration) return null;
	return { ...trip, isShared: true };
}

export function getTripCollaborators(tripId: string) {
	return getDb()
		.select({
			id: tripCollaborators.id,
			tripId: tripCollaborators.tripId,
			userId: tripCollaborators.userId,
			invitedByUserId: tripCollaborators.invitedByUserId,
			createdAt: tripCollaborators.createdAt,
			username: users.username,
			displayName: users.displayName
		})
		.from(tripCollaborators)
		.innerJoin(users, eq(users.id, tripCollaborators.userId))
		.where(eq(tripCollaborators.tripId, tripId))
		.all();
}
