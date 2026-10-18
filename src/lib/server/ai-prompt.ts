interface TripContext {
	name: string;
	destination: string;
	country?: string | null;
	climate: string;
	activities: string[];
	startDate: number;
	endDate: number;
	travelers: number;
	ownerDisplayName?: string;
	contradictions?: { message: string; severity: 'warning' | 'info' }[];
	packingItems: {
		name: string;
		category: string;
		packed: boolean;
		notes?: string | null;
		priority?: 'must' | 'normal' | 'optional';
	}[];
}

export function buildSystemPrompt(trip: TripContext): string {
	const startDate = new Date(trip.startDate).toLocaleDateString();
	const endDate = new Date(trip.endDate).toLocaleDateString();
	const duration = Math.ceil((trip.endDate - trip.startDate) / (1000 * 60 * 60 * 24));
	const packedCount = trip.packingItems.filter((item) => item.packed).length;
	const totalCount = trip.packingItems.length;
	const unpackedItems = trip.packingItems.filter((item) => !item.packed);
	const priorityItems = unpackedItems.filter((item) => item.priority === 'must');

	const categories = new Map<string, string[]>();
	for (const item of unpackedItems) {
		const list = categories.get(item.category) ?? [];
		const detail = [
			item.name,
			item.priority === 'must' ? 'must-pack' : null,
			item.notes ? `note: ${item.notes}` : null
		]
			.filter(Boolean)
			.join(', ');
		list.push(detail);
		categories.set(item.category, list);
	}

	let itemsSummary = '';
	for (const [category, items] of categories) {
		itemsSummary += `\n  ${category}: ${items.join('; ')}`;
	}

	const contradictions = trip.contradictions?.length
		? trip.contradictions.map((contradiction) => `- ${contradiction.message}`).join('\n')
		: '- None identified';

	return `You are PackPal AI, a practical travel packing assistant.

Trip brief:
- Trip: ${trip.name}
- Destination: ${trip.destination}${trip.country ? `, ${trip.country}` : ''}
- Dates: ${startDate} to ${endDate} (${duration} days)
- Climate: ${trip.climate}
- Activities: ${trip.activities.join(', ')}
- Travelers: ${trip.travelers}
- Owner: ${trip.ownerDisplayName ?? 'Unknown'}
- Packing progress: ${packedCount}/${totalCount} items packed
- Must-pack items still unpacked: ${priorityItems.length}

Current contradictions or warnings:
${contradictions}

Unpacked items still on the list:${itemsSummary || '\n  None'}

Rules:
- Be specific, concise, and action-oriented.
- Prioritize unpacked and must-pack items first.
- Call out likely missing essentials based on destination, climate, and activities.
- If useful, include a short section titled "Suggested actions".
- When suggesting concrete checklist additions, format them exactly like:
  ADD_ITEM: item name | category | priority | optional note
- Only emit ADD_ITEM lines for genuinely useful additions.
- Avoid generic filler and avoid repeating the obvious.`;
}
