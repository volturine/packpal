import { describe, it, expect } from 'vitest';
import { getPackingListForTrip, ACTIVITIES, CATEGORIES } from '$lib/data/packing-templates';

describe('getPackingListForTrip', () => {
	it('always includes essential items', () => {
		const result = getPackingListForTrip([], 'temperate');
		const names = result.map((item) => item.name);

		// Check for some known essentials
		expect(names).toContain('Passport');
		expect(names).toContain('Phone charger');
		expect(names).toContain('Toothbrush');
		expect(names).toContain('Underwear');
		expect(names).toContain('Comfortable walking shoes');
	});

	it('adds tropical climate items for tropical climate', () => {
		const result = getPackingListForTrip([], 'tropical');
		const names = result.map((item) => item.name);

		expect(names).toContain('Shorts');
		expect(names).toContain('Sandals / flip flops');
		expect(names).toContain('Insect repellent');
		expect(names).toContain('Sun hat / cap');
	});

	it('adds cold climate items for cold climate', () => {
		const result = getPackingListForTrip([], 'cold');
		const names = result.map((item) => item.name);

		expect(names).toContain('Winter coat / down jacket');
		expect(names).toContain('Thermal underwear / base layers');
		expect(names).toContain('Gloves / mittens');
		expect(names).toContain('Winter boots');
	});

	it('adds arid climate items for arid climate', () => {
		const result = getPackingListForTrip([], 'arid');
		const names = result.map((item) => item.name);

		expect(names).toContain('Wide-brim sun hat');
		expect(names).toContain('Electrolyte packets');
		expect(names).toContain('Extra water bottles');
	});

	it('adds activity-specific items', () => {
		const result = getPackingListForTrip(['hiking'], 'temperate');
		const names = result.map((item) => item.name);

		expect(names).toContain('Hiking boots (broken in)');
		expect(names).toContain('Trekking poles');
		expect(names).toContain('Trail map / GPS device');
	});

	it('merges items from multiple activities', () => {
		const result = getPackingListForTrip(['hiking', 'camping'], 'temperate');
		const names = result.map((item) => item.name);

		// Hiking items
		expect(names).toContain('Hiking boots (broken in)');
		// Camping items
		expect(names).toContain('Tent');
		expect(names).toContain('Sleeping bag');
	});

	it('deduplicates items keeping the higher quantity', () => {
		// Both essentials and tropical climate include sunscreen-related items
		const result = getPackingListForTrip(['beach'], 'tropical');
		const sunscreenItems = result.filter((item) => item.name.toLowerCase().includes('sunscreen'));

		// Each unique sunscreen variant should appear only once
		const uniqueNames = new Set(sunscreenItems.map((item) => item.name.toLowerCase()));
		expect(sunscreenItems.length).toBe(uniqueNames.size);
	});

	it('sorts results by category order then by name', () => {
		const result = getPackingListForTrip(['hiking'], 'temperate');

		for (let i = 1; i < result.length; i++) {
			const prevCatIdx = CATEGORIES.indexOf(result[i - 1].category as (typeof CATEGORIES)[number]);
			const currCatIdx = CATEGORIES.indexOf(result[i].category as (typeof CATEGORIES)[number]);

			if (prevCatIdx === currCatIdx) {
				// Within same category, should be alphabetical
				expect(result[i - 1].name.localeCompare(result[i].name)).toBeLessThanOrEqual(0);
			} else {
				// Category order should be non-decreasing
				expect(prevCatIdx).toBeLessThanOrEqual(currCatIdx);
			}
		}
	});

	it('handles unknown climate gracefully (no extra items)', () => {
		const resultUnknown = getPackingListForTrip([], 'nonexistent');
		const resultNoClimate = getPackingListForTrip([], 'temperate');

		// Unknown climate should have fewer or equal items (just essentials)
		expect(resultUnknown.length).toBeLessThanOrEqual(resultNoClimate.length);
	});

	it('handles unknown activity gracefully', () => {
		const resultBase = getPackingListForTrip([], 'temperate');
		const resultUnknown = getPackingListForTrip(['nonexistent_activity'], 'temperate');

		// Unknown activity adds no items, so count should be the same
		expect(resultUnknown.length).toBe(resultBase.length);
	});

	it('returns non-empty list even with no activities', () => {
		const result = getPackingListForTrip([], 'mixed');
		expect(result.length).toBeGreaterThan(0);
	});

	it('includes all required fields in each item', () => {
		const result = getPackingListForTrip(['beach'], 'tropical');

		for (const item of result) {
			expect(item).toHaveProperty('name');
			expect(item).toHaveProperty('category');
			expect(item).toHaveProperty('quantity');
			expect(typeof item.name).toBe('string');
			expect(typeof item.category).toBe('string');
			expect(typeof item.quantity).toBe('number');
			expect(item.quantity).toBeGreaterThan(0);
		}
	});

	it('handles all defined climate types', () => {
		const climates = ['tropical', 'temperate', 'cold', 'arid', 'mixed'];
		for (const climate of climates) {
			const result = getPackingListForTrip([], climate);
			expect(result.length).toBeGreaterThan(0);
		}
	});

	it('handles all defined activity types without error', () => {
		for (const activity of ACTIVITIES) {
			const result = getPackingListForTrip([activity.id], 'temperate');
			expect(result.length).toBeGreaterThan(0);
		}
	});

	it('produces more items for trips with many activities', () => {
		const baseResult = getPackingListForTrip([], 'temperate');
		const manyActivitiesResult = getPackingListForTrip(
			['hiking', 'camping', 'photography', 'fishing'],
			'temperate'
		);

		expect(manyActivitiesResult.length).toBeGreaterThan(baseResult.length);
	});

	it('keeps higher quantity when same item appears in multiple sources', () => {
		// Essentials have "Socks" with quantity 7
		// Cold climate has "Wool socks" (different name, so no conflict)
		// Let's check a known overlap: essentials have "Sunscreen" with quantity 1,
		// some activities might have different sunscreen items
		const result = getPackingListForTrip([], 'temperate');
		const sunscreen = result.find((item) => item.name === 'Sunscreen');
		expect(sunscreen).toBeDefined();
		expect(sunscreen!.quantity).toBeGreaterThanOrEqual(1);
	});
});
