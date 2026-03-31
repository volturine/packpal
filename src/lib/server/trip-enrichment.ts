import { desc, eq } from 'drizzle-orm';
import { getTripInsightSummary } from '$lib/packing-insights';
import type { PackingItem, Trip } from '$lib/types';
import { db } from '$lib/server/db';
import { packingItems } from '$lib/server/schema';
import { getTripCollaborators, type AccessibleTripRecord } from '$lib/server/trip-access';

export function getTripItems(tripId: string) {
	return db
		.select()
		.from(packingItems)
		.where(eq(packingItems.tripId, tripId))
		.orderBy(desc(packingItems.packed), packingItems.category, packingItems.name)
		.all() as PackingItem[];
}

export function enrichTrip(trip: AccessibleTripRecord, viewerUserId: string) {
	const items = getTripItems(trip.id);
	const collaborators = getTripCollaborators(trip.id);
	const tripRecord = trip as Trip;
	const insights = getTripInsightSummary(tripRecord, items);

	return {
		...trip,
		itemCount: items.length,
		packedCount: items.filter((item) => item.packed).length,
		criticalUnpackedCount: insights.criticalUnpackedCount,
		collaboratorCount: collaborators.length,
		ownerDisplayName: trip.ownerDisplayName,
		isShared: trip.userId !== viewerUserId,
		reminder: insights.reminder,
		tripStatus: insights.tripStatus,
		countdownLabel: insights.countdownLabel,
		contradictions: insights.contradictions,
		collaborators
	};
}
