import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const handle: Handle = async ({ event, resolve }) => {
	// Stripe authenticates webhook requests with a signature instead of browser cookies.
	const isStripeWebhook =
		event.request.method === 'POST' && event.route.id === '/api/billing/webhook';
	if (
		event.url.pathname.startsWith('/api/') &&
		!SAFE_METHODS.has(event.request.method) &&
		!isStripeWebhook &&
		event.request.headers.get('origin') !== event.url.origin
	) {
		return json({ error: 'Invalid request origin.' }, { status: 403 });
	}

	return resolve(event);
};
