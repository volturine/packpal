import { describe, expect, it } from 'vitest';
import { getInitialTripItems } from './trip-items';

describe('getInitialTripItems', () => {
	it('deduplicates overlapping preset and generated items by name', () => {
		const items = getInitialTripItems(['city_break'], 'temperate', [
			{
				name: 'Comfortable walking shoes',
				category: 'Footwear',
				quantity: 2,
				notes: 'Broken in pair only',
				priority: 'must'
			},
			{
				name: 'Portable umbrella',
				category: 'Travel Essentials',
				quantity: 1,
				notes: null,
				priority: 'optional'
			}
		]);

		const walkingShoes = items.filter(
			(item) => item.name.toLowerCase() === 'comfortable walking shoes'
		);
		expect(walkingShoes).toHaveLength(1);
		expect(walkingShoes[0]).toMatchObject({
			quantity: 2,
			isCustom: true,
			notes: 'Broken in pair only',
			priority: 'must'
		});

		expect(items.some((item) => item.name === 'Portable umbrella')).toBe(true);
	});

	it('keeps template-only items as non-custom normal priority', () => {
		const items = getInitialTripItems(['hiking'], 'temperate', []);
		const passport = items.find((item) => item.name === 'Passport');

		expect(passport).toMatchObject({
			isCustom: false,
			priority: 'normal'
		});
	});
});
