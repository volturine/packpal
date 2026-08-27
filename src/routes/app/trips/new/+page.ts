import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch('/api/packing-presets');
	return { presets: response.ok ? await response.json() : [] };
};
