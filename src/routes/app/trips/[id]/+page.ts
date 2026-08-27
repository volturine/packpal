import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const [tripRes, itemsRes, presetsRes] = await Promise.all([
		fetch(`/api/trips/${params.id}`),
		fetch(`/api/packing-items?tripId=${params.id}`),
		fetch('/api/packing-presets')
	]);

	if (!tripRes.ok) {
		return {
			tripId: params.id,
			trip: null,
			items: [],
			presets: [],
			collaborators: [],
			loadError: true
		};
	}

	const trip = await tripRes.json();
	return {
		tripId: params.id,
		trip,
		items: await itemsRes.json(),
		presets: presetsRes.ok ? await presetsRes.json() : [],
		collaborators: trip.collaborators ?? [],
		loadError: false
	};
};
