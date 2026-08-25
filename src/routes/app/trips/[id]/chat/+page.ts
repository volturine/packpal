import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const [tripRes, itemsRes, messagesRes] = await Promise.all([
		fetch(`/api/trips/${params.id}`),
		fetch(`/api/packing-items?tripId=${params.id}`),
		fetch(`/api/chat-messages?tripId=${params.id}`)
	]);

	if (!tripRes.ok) {
		return {
			tripId: params.id,
			trip: null,
			items: [],
			messages: [],
			hasMoreMessages: false,
			loadError: true
		};
	}

	const chatData = await messagesRes.json();
	return {
		tripId: params.id,
		trip: await tripRes.json(),
		items: await itemsRes.json(),
		messages: chatData.messages,
		hasMoreMessages: chatData.hasMore,
		loadError: false
	};
};
