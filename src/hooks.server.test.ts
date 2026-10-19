import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { handle } from './hooks.server';

const ORIGIN = 'https://packpal.test';

function event(method: string, origin?: string, route = '/api/trips'): RequestEvent {
	const url = new URL(route, ORIGIN);
	return {
		url,
		route: { id: route },
		request: new Request(url, {
			method,
			headers: origin === undefined ? {} : { origin }
		})
	} as RequestEvent;
}

describe('API origin protection', () => {
	it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
		'rejects foreign or absent origins for %s',
		async (method) => {
			for (const origin of [
				undefined,
				'null',
				'https://evil.test',
				'https://packpal.test.evil.test'
			]) {
				const resolve = vi.fn();
				const response = await handle({ event: event(method, origin), resolve });
				expect(response.status).toBe(403);
				expect(resolve).not.toHaveBeenCalled();
			}
		}
	);

	it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('allows same-origin %s', async (method) => {
		const response = new Response('ok');
		const resolve = vi.fn().mockResolvedValue(response);
		expect(await handle({ event: event(method, ORIGIN), resolve })).toBe(response);
	});

	it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s without an origin', async (method) => {
		const resolve = vi.fn().mockResolvedValue(new Response('ok'));
		expect((await handle({ event: event(method), resolve })).status).toBe(200);
	});

	it('passes webhook POSTs through to signature verification, including a trailing slash', async () => {
		const webhook = event('POST', undefined, '/api/billing/webhook');
		webhook.url.pathname += '/';
		const resolve = vi.fn().mockResolvedValue(new Response('signature required', { status: 400 }));
		expect((await handle({ event: webhook, resolve })).status).toBe(400);
		expect(resolve).toHaveBeenCalledWith(webhook);
	});

	it('does not exempt other webhook methods or similarly named paths', async () => {
		for (const request of [
			event('DELETE', undefined, '/api/billing/webhook'),
			event('POST', undefined, '/api/billing/webhook-extra')
		]) {
			const resolve = vi.fn();
			expect((await handle({ event: request, resolve })).status).toBe(403);
			expect(resolve).not.toHaveBeenCalled();
		}
	});
});
