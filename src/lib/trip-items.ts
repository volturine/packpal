import type { PackingPresetItem } from '$lib/types';
import { getPackingListForTrip, type Climate } from '$lib/data/packing-templates';

export interface InitialTripItem {
	name: string;
	category: string;
	quantity: number;
	isCustom: boolean;
	notes?: string;
	priority: 'must' | 'normal' | 'optional';
}

export function getInitialTripItems(
	activities: string[],
	climate: Climate,
	presetItems: PackingPresetItem[]
) {
	const itemMap = new Map<string, InitialTripItem>();

	for (const item of getPackingListForTrip(activities, climate)) {
		itemMap.set(item.name.trim().toLowerCase(), {
			name: item.name,
			category: item.category,
			quantity: item.quantity,
			isCustom: false,
			priority: 'normal'
		});
	}

	for (const item of presetItems) {
		const key = item.name.trim().toLowerCase();
		const existing = itemMap.get(key);
		if (!existing) {
			itemMap.set(key, {
				name: item.name,
				category: item.category,
				quantity: item.quantity,
				isCustom: true,
				notes: item.notes ?? undefined,
				priority: item.priority
			});
			continue;
		}

		itemMap.set(key, {
			name: existing.name,
			category: existing.category,
			quantity: Math.max(existing.quantity, item.quantity),
			isCustom: existing.isCustom || true,
			notes: item.notes ?? existing.notes,
			priority:
				item.priority === 'must' || existing.priority === 'must'
					? 'must'
					: item.priority === 'optional' && existing.priority === 'optional'
						? 'optional'
						: 'normal'
		});
	}

	return Array.from(itemMap.values());
}
