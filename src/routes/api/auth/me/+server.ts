import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionFromCookies } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	const session = getSessionFromCookies(event);
	if (!session) {
		return json({ user: null });
	}
	return json({
		user: {
			id: session.userId,
			username: session.username,
			displayName: session.displayName
		}
	});
};
