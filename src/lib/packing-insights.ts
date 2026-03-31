import { ACTIVITIES, type Climate } from '$lib/data/packing-templates';
import type { PackingItem, PackingItemPriority, Trip } from '$lib/types';

export const CRITICAL_ITEM_KEYWORDS = [
	'passport',
	'visa',
	'wallet',
	'phone',
	'charger',
	'medication',
	'medicine',
	'prescription',
	'tickets',
	'boarding pass',
	'keys'
];

export interface ReminderSummary {
	label: string;
	tone: 'info' | 'warning' | 'urgent';
}

export interface TripContradiction {
	message: string;
	severity: 'warning' | 'info';
}

export interface TripInsightSummary {
	criticalUnpackedCount: number;
	priorityUnpackedCount: number;
	reminder: ReminderSummary | null;
	contradictions: TripContradiction[];
	countdownLabel: string | null;
	tripStatus: 'upcoming' | 'active' | 'completed';
}

export function isCriticalItem(item: Pick<PackingItem, 'name' | 'priority'>) {
	if (item.priority === 'must') return true;
	const lowerName = item.name.toLowerCase();
	return CRITICAL_ITEM_KEYWORDS.some((keyword) => lowerName.includes(keyword));
}

export function getTripStatus(startDate: number, endDate: number) {
	const now = Date.now();
	if (now < startDate) return 'upcoming' as const;
	if (now > endDate) return 'completed' as const;
	return 'active' as const;
}

export function getCountdownLabel(startDate: number) {
	const diff = startDate - Date.now();
	const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
	if (days < 0) return null;
	if (days === 0) return 'Today';
	if (days === 1) return 'Tomorrow';
	return `${days} days`;
}

export function getReminderSummary(
	trip: Pick<Trip, 'startDate' | 'endDate'>,
	items: PackingItem[]
) {
	const status = getTripStatus(trip.startDate, trip.endDate);
	if (status === 'completed') return null;

	const unpackedCritical = items.filter((item) => !item.packed && isCriticalItem(item)).length;
	const hoursUntilDeparture = Math.round((trip.startDate - Date.now()) / (1000 * 60 * 60));

	if (status === 'active') {
		return unpackedCritical > 0
			? {
					label: `${unpackedCritical} critical item${unpackedCritical === 1 ? '' : 's'} still unpacked`,
					tone: 'urgent' as const
				}
			: { label: 'Trip is in progress', tone: 'info' as const };
	}

	if (hoursUntilDeparture <= 24) {
		return unpackedCritical > 0
			? {
					label: `Departure soon: ${unpackedCritical} critical item${unpackedCritical === 1 ? '' : 's'} left`,
					tone: 'urgent' as const
				}
			: { label: 'Departure within 24 hours', tone: 'warning' as const };
	}

	if (hoursUntilDeparture <= 72 && unpackedCritical > 0) {
		return {
			label: `${unpackedCritical} critical item${unpackedCritical === 1 ? '' : 's'} still to pack`,
			tone: 'warning' as const
		};
	}

	return null;
}

function hasItemLike(items: Pick<PackingItem, 'name'>[], ...keywords: string[]) {
	return items.some((item) => {
		const lowerName = item.name.toLowerCase();
		return keywords.some((keyword) => lowerName.includes(keyword));
	});
}

export function getTripContradictions(
	trip: Pick<Trip, 'climate' | 'activities' | 'destination' | 'country'>,
	items: Pick<PackingItem, 'name' | 'packed'>[]
) {
	const contradictions: TripContradiction[] = [];

	if (
		trip.climate === 'cold' &&
		!hasItemLike(items, 'jacket', 'coat', 'gloves', 'scarf', 'thermal')
	) {
		contradictions.push({
			message: 'Cold-weather trip without obvious outerwear or thermal layers.',
			severity: 'warning'
		});
	}

	if (
		trip.activities.includes('beach') &&
		!hasItemLike(items, 'sunscreen', 'swimsuit', 'sandals')
	) {
		contradictions.push({
			message: 'Beach trip without sunscreen, swimwear, or sandals on the list.',
			severity: 'warning'
		});
	}

	if (
		trip.activities.includes('business') &&
		!hasItemLike(items, 'laptop', 'charger', 'blazer', 'dress shirt')
	) {
		contradictions.push({
			message: 'Business trip without obvious work gear or formal wear.',
			severity: 'warning'
		});
	}

	if (
		trip.activities.includes('skiing') &&
		!hasItemLike(items, 'gloves', 'ski', 'thermal', 'goggles')
	) {
		contradictions.push({
			message: 'Ski trip missing obvious cold-weather or ski-specific gear.',
			severity: 'warning'
		});
	}

	return contradictions;
}

export function getTripInsightSummary(trip: Trip, items: PackingItem[]): TripInsightSummary {
	const criticalUnpackedCount = items.filter((item) => !item.packed && isCriticalItem(item)).length;
	const priorityUnpackedCount = items.filter(
		(item) => !item.packed && item.priority === 'must'
	).length;

	return {
		criticalUnpackedCount,
		priorityUnpackedCount,
		reminder: getReminderSummary(trip, items),
		contradictions: getTripContradictions(trip, items),
		countdownLabel: getCountdownLabel(trip.startDate),
		tripStatus: getTripStatus(trip.startDate, trip.endDate)
	};
}

export function getPrioritySortValue(priority: PackingItemPriority) {
	if (priority === 'must') return 0;
	if (priority === 'normal') return 1;
	return 2;
}

export function formatActivityNames(activityIds: string[]) {
	return activityIds.map(
		(activityId) =>
			ACTIVITIES.find((activity) => activity.id === activityId)?.name ??
			activityId.replace(/_/g, ' ')
	);
}

export function getSeasonHint(startDate: number, destination: string, climate: Climate) {
	const month = new Date(startDate).getUTCMonth();
	const lowerDestination = destination.toLowerCase();
	const southernHemisphere = [
		'australia',
		'new zealand',
		'argentina',
		'chile',
		'south africa'
	].some((keyword) => lowerDestination.includes(keyword));

	const warmMonths = southernHemisphere ? [11, 0, 1] : [5, 6, 7];
	if (climate === 'cold' && warmMonths.includes(month)) {
		return 'Trip timing suggests double-checking actual forecast because the selected climate may not match the season.';
	}

	return null;
}
