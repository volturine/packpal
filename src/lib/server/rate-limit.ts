interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;
	for (const [key, entry] of store) {
		if (entry.resetAt <= now) store.delete(key);
	}
}

export function resetRateLimitStore() {
	store.clear();
}

export function rateLimit(
	key: string,
	maxRequests: number,
	windowMs: number
): { allowed: boolean; retryAfterMs: number } {
	cleanup();
	const now = Date.now();
	const entry = store.get(key);

	if (!entry || entry.resetAt <= now) {
		store.set(key, { count: 1, resetAt: now + windowMs });
		return { allowed: true, retryAfterMs: 0 };
	}

	if (entry.count < maxRequests) {
		entry.count++;
		return { allowed: true, retryAfterMs: 0 };
	}

	return { allowed: false, retryAfterMs: entry.resetAt - now };
}

export function rateLimitByIp(
	event: { getClientAddress: () => string },
	endpoint: string,
	maxRequests: number,
	windowMs: number
) {
	const ip = event.getClientAddress();
	return rateLimit(`${endpoint}:${ip}`, maxRequests, windowMs);
}
