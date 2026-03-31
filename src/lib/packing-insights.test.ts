import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PackingItem, Trip } from '$lib/types';
import {
	isCriticalItem,
	getTripStatus,
	getCountdownLabel,
	getReminderSummary,
	getTripContradictions,
	getTripInsightSummary,
	getPrioritySortValue,
	formatActivityNames,
	getSeasonHint,
	CRITICAL_ITEM_KEYWORDS
} from '$lib/packing-insights';

// Helper to create a minimal PackingItem for testing
function makeItem(
	overrides: Partial<PackingItem> & { name: string }
): Pick<PackingItem, 'name' | 'priority' | 'packed'> {
	return {
		name: overrides.name,
		priority: overrides.priority ?? 'normal',
		packed: overrides.packed ?? false
	};
}

function makeFullItem(overrides: Partial<PackingItem> & { name: string }): PackingItem {
	return {
		id: overrides.id ?? 'item-1',
		tripId: overrides.tripId ?? 'trip-1',
		userId: overrides.userId ?? 'user-1',
		name: overrides.name,
		category: overrides.category ?? 'Clothing',
		packed: overrides.packed ?? false,
		quantity: overrides.quantity ?? 1,
		isCustom: overrides.isCustom ?? false,
		notes: overrides.notes ?? null,
		priority: overrides.priority ?? 'normal'
	};
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
	return {
		id: 'trip-1',
		userId: 'user-1',
		name: 'Test Trip',
		destination: 'Paris',
		country: 'France',
		startDate: overrides.startDate ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
		endDate: overrides.endDate ?? Date.now() + 14 * 24 * 60 * 60 * 1000,
		activities: overrides.activities ?? ['city_break'],
		climate: overrides.climate ?? 'temperate',
		travelers: 1,
		notes: null,
		createdAt: Date.now(),
		archivedAt: null,
		...overrides
	};
}

describe('isCriticalItem', () => {
	it('returns true for items with "must" priority', () => {
		expect(isCriticalItem(makeItem({ name: 'T-shirt', priority: 'must' }))).toBe(true);
	});

	it('returns true for items matching critical keywords', () => {
		for (const keyword of CRITICAL_ITEM_KEYWORDS) {
			expect(isCriticalItem(makeItem({ name: keyword }))).toBe(true);
		}
	});

	it('matches keywords case-insensitively', () => {
		expect(isCriticalItem(makeItem({ name: 'PASSPORT' }))).toBe(true);
		expect(isCriticalItem(makeItem({ name: 'My Phone Case' }))).toBe(true);
	});

	it('matches partial keyword presence in name', () => {
		expect(isCriticalItem(makeItem({ name: 'Phone charger cable' }))).toBe(true);
		expect(isCriticalItem(makeItem({ name: 'Prescription medication bag' }))).toBe(true);
	});

	it('returns false for non-critical items', () => {
		expect(isCriticalItem(makeItem({ name: 'T-shirt', priority: 'normal' }))).toBe(false);
		expect(isCriticalItem(makeItem({ name: 'Socks', priority: 'optional' }))).toBe(false);
	});
});

describe('getTripStatus', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns "upcoming" when now is before start date', () => {
		const now = new Date('2025-06-01T12:00:00Z').getTime();
		vi.setSystemTime(now);
		const start = new Date('2025-06-15T00:00:00Z').getTime();
		const end = new Date('2025-06-20T00:00:00Z').getTime();
		expect(getTripStatus(start, end)).toBe('upcoming');
	});

	it('returns "active" when now is between start and end', () => {
		const now = new Date('2025-06-17T12:00:00Z').getTime();
		vi.setSystemTime(now);
		const start = new Date('2025-06-15T00:00:00Z').getTime();
		const end = new Date('2025-06-20T00:00:00Z').getTime();
		expect(getTripStatus(start, end)).toBe('active');
	});

	it('returns "completed" when now is after end date', () => {
		const now = new Date('2025-06-25T12:00:00Z').getTime();
		vi.setSystemTime(now);
		const start = new Date('2025-06-15T00:00:00Z').getTime();
		const end = new Date('2025-06-20T00:00:00Z').getTime();
		expect(getTripStatus(start, end)).toBe('completed');
	});
});

describe('getCountdownLabel', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns "Today" when trip starts today', () => {
		const now = new Date('2025-06-15T10:00:00Z').getTime();
		vi.setSystemTime(now);
		// diff is 0 → Math.ceil(0) = 0 → "Today"
		const start = now;
		expect(getCountdownLabel(start)).toBe('Today');
	});

	it('returns "Tomorrow" when trip starts tomorrow', () => {
		const now = new Date('2025-06-15T10:00:00Z').getTime();
		vi.setSystemTime(now);
		// diff is ~0.5 days → Math.ceil(0.5) = 1 → "Tomorrow"
		const start = now + 0.5 * 24 * 60 * 60 * 1000;
		expect(getCountdownLabel(start)).toBe('Tomorrow');
	});

	it('returns "X days" for trips further out', () => {
		const now = new Date('2025-06-15T10:00:00Z').getTime();
		vi.setSystemTime(now);
		const start = now + 5 * 24 * 60 * 60 * 1000;
		expect(getCountdownLabel(start)).toBe('5 days');
	});

	it('returns null for past dates', () => {
		const now = new Date('2025-06-20T10:00:00Z').getTime();
		vi.setSystemTime(now);
		const start = new Date('2025-06-15T10:00:00Z').getTime();
		expect(getCountdownLabel(start)).toBeNull();
	});
});

describe('getReminderSummary', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns null for completed trips', () => {
		const now = new Date('2025-06-25T12:00:00Z').getTime();
		vi.setSystemTime(now);
		const trip = {
			startDate: new Date('2025-06-15T00:00:00Z').getTime(),
			endDate: new Date('2025-06-20T00:00:00Z').getTime()
		};
		expect(getReminderSummary(trip, [])).toBeNull();
	});

	it('returns urgent for active trip with unpacked critical items', () => {
		const now = new Date('2025-06-17T12:00:00Z').getTime();
		vi.setSystemTime(now);
		const trip = {
			startDate: new Date('2025-06-15T00:00:00Z').getTime(),
			endDate: new Date('2025-06-20T00:00:00Z').getTime()
		};
		const items = [
			makeFullItem({ name: 'Passport', packed: false, priority: 'must' }),
			makeFullItem({ name: 'T-shirt', packed: true })
		];
		const result = getReminderSummary(trip, items);
		expect(result).not.toBeNull();
		expect(result!.tone).toBe('urgent');
		expect(result!.label).toContain('critical item');
	});

	it('returns info for active trip with all critical items packed', () => {
		const now = new Date('2025-06-17T12:00:00Z').getTime();
		vi.setSystemTime(now);
		const trip = {
			startDate: new Date('2025-06-15T00:00:00Z').getTime(),
			endDate: new Date('2025-06-20T00:00:00Z').getTime()
		};
		const items = [makeFullItem({ name: 'Passport', packed: true, priority: 'must' })];
		const result = getReminderSummary(trip, items);
		expect(result).not.toBeNull();
		expect(result!.tone).toBe('info');
		expect(result!.label).toBe('Trip is in progress');
	});

	it('returns urgent for upcoming trip within 24h with unpacked critical items', () => {
		const now = new Date('2025-06-14T20:00:00Z').getTime();
		vi.setSystemTime(now);
		const trip = {
			startDate: new Date('2025-06-15T06:00:00Z').getTime(), // 10 hours away
			endDate: new Date('2025-06-20T00:00:00Z').getTime()
		};
		const items = [makeFullItem({ name: 'Passport', packed: false, priority: 'must' })];
		const result = getReminderSummary(trip, items);
		expect(result).not.toBeNull();
		expect(result!.tone).toBe('urgent');
		expect(result!.label).toContain('Departure soon');
	});

	it('returns warning for upcoming trip within 24h with no critical items', () => {
		const now = new Date('2025-06-14T20:00:00Z').getTime();
		vi.setSystemTime(now);
		const trip = {
			startDate: new Date('2025-06-15T06:00:00Z').getTime(),
			endDate: new Date('2025-06-20T00:00:00Z').getTime()
		};
		const items = [makeFullItem({ name: 'T-shirt', packed: false })];
		const result = getReminderSummary(trip, items);
		expect(result).not.toBeNull();
		expect(result!.tone).toBe('warning');
		expect(result!.label).toContain('24 hours');
	});

	it('returns warning for upcoming trip within 72h with critical items', () => {
		const now = new Date('2025-06-13T12:00:00Z').getTime();
		vi.setSystemTime(now);
		const trip = {
			startDate: new Date('2025-06-15T06:00:00Z').getTime(), // ~42 hours away
			endDate: new Date('2025-06-20T00:00:00Z').getTime()
		};
		const items = [makeFullItem({ name: 'Passport', packed: false, priority: 'must' })];
		const result = getReminderSummary(trip, items);
		expect(result).not.toBeNull();
		expect(result!.tone).toBe('warning');
		expect(result!.label).toContain('critical item');
	});

	it('returns null for upcoming trip far in the future', () => {
		const now = new Date('2025-06-01T12:00:00Z').getTime();
		vi.setSystemTime(now);
		const trip = {
			startDate: new Date('2025-07-15T00:00:00Z').getTime(),
			endDate: new Date('2025-07-20T00:00:00Z').getTime()
		};
		const items = [makeFullItem({ name: 'T-shirt', packed: false })];
		expect(getReminderSummary(trip, items)).toBeNull();
	});
});

describe('getTripContradictions', () => {
	it('warns about cold trip without outerwear', () => {
		const trip = { climate: 'cold' as const, activities: [], destination: 'Oslo', country: null };
		const items = [makeItem({ name: 'T-shirt' }), makeItem({ name: 'Shorts' })];
		const result = getTripContradictions(trip, items);
		expect(result).toHaveLength(1);
		expect(result[0].message).toContain('Cold-weather');
		expect(result[0].severity).toBe('warning');
	});

	it('does not warn about cold trip with outerwear', () => {
		const trip = { climate: 'cold' as const, activities: [], destination: 'Oslo', country: null };
		const items = [makeItem({ name: 'Winter jacket' }), makeItem({ name: 'T-shirt' })];
		expect(getTripContradictions(trip, items)).toHaveLength(0);
	});

	it('warns about beach trip without beach gear', () => {
		const trip = {
			climate: 'tropical' as const,
			activities: ['beach'],
			destination: 'Bali',
			country: null
		};
		const items = [makeItem({ name: 'T-shirt' })];
		const result = getTripContradictions(trip, items);
		expect(result.some((c) => c.message.includes('Beach'))).toBe(true);
	});

	it('does not warn about beach trip with beach gear', () => {
		const trip = {
			climate: 'tropical' as const,
			activities: ['beach'],
			destination: 'Bali',
			country: null
		};
		const items = [makeItem({ name: 'Sunscreen' }), makeItem({ name: 'T-shirt' })];
		expect(
			getTripContradictions(trip, items).filter((c) => c.message.includes('Beach'))
		).toHaveLength(0);
	});

	it('warns about business trip without work gear', () => {
		const trip = {
			climate: 'temperate' as const,
			activities: ['business'],
			destination: 'NYC',
			country: null
		};
		const items = [makeItem({ name: 'T-shirt' })];
		const result = getTripContradictions(trip, items);
		expect(result.some((c) => c.message.includes('Business'))).toBe(true);
	});

	it('warns about skiing trip without ski gear', () => {
		const trip = {
			climate: 'cold' as const,
			activities: ['skiing'],
			destination: 'Alps',
			country: null
		};
		const items = [makeItem({ name: 'T-shirt' })];
		const result = getTripContradictions(trip, items);
		expect(result.some((c) => c.message.includes('Ski'))).toBe(true);
	});

	it('returns empty array when no contradictions', () => {
		const trip = {
			climate: 'temperate' as const,
			activities: ['city_break'],
			destination: 'Rome',
			country: null
		};
		const items = [makeItem({ name: 'T-shirt' })];
		expect(getTripContradictions(trip, items)).toHaveLength(0);
	});

	it('can return multiple contradictions', () => {
		const trip = {
			climate: 'cold' as const,
			activities: ['skiing'],
			destination: 'Alps',
			country: null
		};
		const items = [makeItem({ name: 'T-shirt' })];
		const result = getTripContradictions(trip, items);
		// Both cold-weather warning and ski gear warning
		expect(result.length).toBeGreaterThanOrEqual(2);
	});
});

describe('getPrioritySortValue', () => {
	it('returns 0 for "must"', () => {
		expect(getPrioritySortValue('must')).toBe(0);
	});

	it('returns 1 for "normal"', () => {
		expect(getPrioritySortValue('normal')).toBe(1);
	});

	it('returns 2 for "optional"', () => {
		expect(getPrioritySortValue('optional')).toBe(2);
	});
});

describe('formatActivityNames', () => {
	it('maps known activity IDs to display names', () => {
		const result = formatActivityNames(['hiking', 'beach', 'business']);
		expect(result).toContain('Hiking / Trekking');
		expect(result).toContain('Beach Vacation');
		expect(result).toContain('Business Trip');
	});

	it('falls back to formatted ID for unknown activities', () => {
		const result = formatActivityNames(['unknown_activity']);
		expect(result).toContain('unknown activity');
	});

	it('returns empty array for empty input', () => {
		expect(formatActivityNames([])).toEqual([]);
	});
});

describe('getSeasonHint', () => {
	it('warns about cold climate in northern hemisphere summer', () => {
		// July (month 6) in Paris - cold climate seems off
		const startDate = new Date('2025-07-15T00:00:00Z').getTime();
		const result = getSeasonHint(startDate, 'Paris', 'cold');
		expect(result).not.toBeNull();
		expect(result).toContain('double-checking');
	});

	it('warns about cold climate in southern hemisphere summer', () => {
		// December (month 11) in Sydney - cold climate seems off
		const startDate = new Date('2025-12-15T00:00:00Z').getTime();
		const result = getSeasonHint(startDate, 'Sydney, Australia', 'cold');
		expect(result).not.toBeNull();
	});

	it('returns null for cold climate in appropriate season', () => {
		// January in Paris - cold makes sense
		const startDate = new Date('2025-01-15T00:00:00Z').getTime();
		const result = getSeasonHint(startDate, 'Paris', 'cold');
		expect(result).toBeNull();
	});

	it('returns null for non-cold climates', () => {
		const startDate = new Date('2025-07-15T00:00:00Z').getTime();
		expect(getSeasonHint(startDate, 'Paris', 'tropical')).toBeNull();
		expect(getSeasonHint(startDate, 'Paris', 'temperate')).toBeNull();
		expect(getSeasonHint(startDate, 'Paris', 'arid')).toBeNull();
	});

	it('detects southern hemisphere destinations', () => {
		// June (month 5) in New Zealand - cold is fine (winter there)
		const startDate = new Date('2025-06-15T00:00:00Z').getTime();
		expect(getSeasonHint(startDate, 'Auckland, New Zealand', 'cold')).toBeNull();
	});
});

describe('getTripInsightSummary', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns a complete insight summary', () => {
		const now = new Date('2025-06-10T12:00:00Z').getTime();
		vi.setSystemTime(now);

		const trip = makeTrip({
			startDate: new Date('2025-06-15T00:00:00Z').getTime(),
			endDate: new Date('2025-06-20T00:00:00Z').getTime(),
			climate: 'temperate',
			activities: ['city_break']
		});

		const items = [
			makeFullItem({ name: 'Passport', packed: false, priority: 'must' }),
			makeFullItem({ name: 'T-shirt', packed: true }),
			makeFullItem({ name: 'Socks', packed: false, priority: 'normal' })
		];

		const result = getTripInsightSummary(trip, items);

		expect(result.criticalUnpackedCount).toBe(1); // Passport
		expect(result.priorityUnpackedCount).toBe(1); // Passport (must priority)
		expect(result.tripStatus).toBe('upcoming');
		expect(result.countdownLabel).toBe('5 days');
		expect(result.contradictions).toBeInstanceOf(Array);
	});

	it('counts all critical items correctly', () => {
		const now = new Date('2025-06-10T12:00:00Z').getTime();
		vi.setSystemTime(now);

		const trip = makeTrip({
			startDate: now + 30 * 24 * 60 * 60 * 1000,
			endDate: now + 37 * 24 * 60 * 60 * 1000
		});

		const items = [
			makeFullItem({ name: 'Passport', packed: false }), // critical by keyword
			makeFullItem({ name: 'Wallet', packed: false }), // critical by keyword
			makeFullItem({ name: 'Phone', packed: true }), // critical but packed
			makeFullItem({ name: 'Important thing', packed: false, priority: 'must' }), // critical by priority
			makeFullItem({ name: 'T-shirt', packed: false }) // not critical
		];

		const result = getTripInsightSummary(trip, items);
		expect(result.criticalUnpackedCount).toBe(3); // passport, wallet, important thing
		expect(result.priorityUnpackedCount).toBe(1); // only "must" priority unpacked
	});
});
