import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch('/api/trips');
	return { trips: response.ok ? await response.json() : [] };
};
