import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	clearSessionCookie(event);
	return json({ ok: true });
};
