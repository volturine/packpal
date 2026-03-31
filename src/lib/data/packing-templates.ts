export interface PackingTemplateItem {
	name: string;
	category: string;
	quantity: number;
}

export interface Activity {
	id: string;
	name: string;
	icon: string;
	description: string;
	group: string;
}

export interface ActivityGroup {
	id: string;
	name: string;
}

export const ACTIVITY_GROUPS: ActivityGroup[] = [
	{ id: 'adventure', name: 'Adventure & Outdoors' },
	{ id: 'water', name: 'Water Activities' },
	{ id: 'winter', name: 'Winter Sports' },
	{ id: 'urban', name: 'Urban & Cultural' },
	{ id: 'leisure', name: 'Leisure & Wellness' },
	{ id: 'special', name: 'Special Occasions' },
	{ id: 'travel_style', name: 'Travel Style' }
];

export const ACTIVITIES: Activity[] = [
	// Adventure & Outdoors
	{
		id: 'hiking',
		name: 'Hiking / Trekking',
		icon: '&#x26F0;',
		description: 'Day hikes or multi-day treks',
		group: 'adventure'
	},
	{
		id: 'camping',
		name: 'Camping',
		icon: '&#x1F3D5;',
		description: 'Tent or car camping',
		group: 'adventure'
	},
	{
		id: 'rock_climbing',
		name: 'Rock Climbing',
		icon: '&#x1F9D7;',
		description: 'Indoor or outdoor climbing',
		group: 'adventure'
	},
	{
		id: 'cycling',
		name: 'Cycling',
		icon: '&#x1F6B4;',
		description: 'Road or mountain biking',
		group: 'adventure'
	},
	{
		id: 'safari',
		name: 'Safari',
		icon: '&#x1F981;',
		description: 'Wildlife safari adventure',
		group: 'adventure'
	},
	{
		id: 'fishing',
		name: 'Fishing',
		icon: '&#x1F3A3;',
		description: 'Fresh or saltwater fishing',
		group: 'adventure'
	},
	{
		id: 'horseback',
		name: 'Horseback Riding',
		icon: '&#x1F40E;',
		description: 'Trail or ranch riding',
		group: 'adventure'
	},
	// Water Activities
	{
		id: 'beach',
		name: 'Beach Vacation',
		icon: '&#x1F3D6;',
		description: 'Sun, sand, and relaxation',
		group: 'water'
	},
	{
		id: 'scuba_diving',
		name: 'Scuba Diving',
		icon: '&#x1F93F;',
		description: 'Open water or reef diving',
		group: 'water'
	},
	{
		id: 'snorkeling',
		name: 'Snorkeling',
		icon: '&#x1F420;',
		description: 'Shallow water snorkeling',
		group: 'water'
	},
	{
		id: 'surfing',
		name: 'Surfing',
		icon: '&#x1F3C4;',
		description: 'Wave surfing or bodyboarding',
		group: 'water'
	},
	{
		id: 'kayaking',
		name: 'Kayaking / Canoeing',
		icon: '&#x1F6F6;',
		description: 'River or sea kayaking',
		group: 'water'
	},
	{
		id: 'cruise',
		name: 'Cruise',
		icon: '&#x1F6A2;',
		description: 'Ocean or river cruise',
		group: 'water'
	},
	{
		id: 'sailing',
		name: 'Sailing',
		icon: '&#x26F5;',
		description: 'Sailboat or yacht trip',
		group: 'water'
	},
	// Winter Sports
	{
		id: 'skiing',
		name: 'Skiing',
		icon: '&#x26F7;',
		description: 'Downhill or cross-country skiing',
		group: 'winter'
	},
	{
		id: 'snowboarding',
		name: 'Snowboarding',
		icon: '&#x1F3C2;',
		description: 'Snowboarding on slopes',
		group: 'winter'
	},
	{
		id: 'ice_skating',
		name: 'Ice Skating',
		icon: '&#x26F8;',
		description: 'Indoor or outdoor skating',
		group: 'winter'
	},
	{
		id: 'snowshoeing',
		name: 'Snowshoeing',
		icon: '&#x1F3D4;',
		description: 'Winter trail walking',
		group: 'winter'
	},
	// Urban & Cultural
	{
		id: 'city_break',
		name: 'City Break',
		icon: '&#x1F3D9;',
		description: 'Urban sightseeing and culture',
		group: 'urban'
	},
	{
		id: 'museum_tour',
		name: 'Museum / Gallery Tour',
		icon: '&#x1F3DB;',
		description: 'Art and history exploration',
		group: 'urban'
	},
	{
		id: 'food_tour',
		name: 'Food & Culinary Tour',
		icon: '&#x1F37D;',
		description: 'Local cuisine and cooking',
		group: 'urban'
	},
	{
		id: 'photography',
		name: 'Photography Trip',
		icon: '&#x1F4F7;',
		description: 'Dedicated photo expedition',
		group: 'urban'
	},
	{
		id: 'nightlife',
		name: 'Nightlife & Clubbing',
		icon: '&#x1F378;',
		description: 'Bars, clubs, and night scene',
		group: 'urban'
	},
	{
		id: 'cultural_religious',
		name: 'Cultural / Religious Visit',
		icon: '&#x1F54C;',
		description: 'Temples, churches, sacred sites',
		group: 'urban'
	},
	// Leisure & Wellness
	{
		id: 'spa_wellness',
		name: 'Spa & Wellness',
		icon: '&#x1F9D6;',
		description: 'Relaxation and spa treatments',
		group: 'leisure'
	},
	{
		id: 'yoga_retreat',
		name: 'Yoga Retreat',
		icon: '&#x1F9D8;',
		description: 'Yoga and meditation',
		group: 'leisure'
	},
	{
		id: 'golf',
		name: 'Golf',
		icon: '&#x26F3;',
		description: 'Golf resort or course visit',
		group: 'leisure'
	},
	{
		id: 'resort',
		name: 'Resort Stay',
		icon: '&#x1F3E8;',
		description: 'All-inclusive or luxury resort',
		group: 'leisure'
	},
	// Special Occasions
	{
		id: 'business',
		name: 'Business Trip',
		icon: '&#x1F4BC;',
		description: 'Meetings, conferences, work',
		group: 'special'
	},
	{
		id: 'wedding',
		name: 'Wedding / Formal Event',
		icon: '&#x1F492;',
		description: 'Formal celebrations',
		group: 'special'
	},
	{
		id: 'festival',
		name: 'Music Festival',
		icon: '&#x1F3B5;',
		description: 'Outdoor music events',
		group: 'special'
	},
	{
		id: 'family_vacation',
		name: 'Family Vacation',
		icon: '&#x1F46A;',
		description: 'Trip with kids',
		group: 'special'
	},
	{
		id: 'honeymoon',
		name: 'Honeymoon',
		icon: '&#x1F496;',
		description: 'Romantic getaway',
		group: 'special'
	},
	{
		id: 'study_abroad',
		name: 'Study Abroad',
		icon: '&#x1F393;',
		description: 'Extended study trip',
		group: 'special'
	},
	{
		id: 'volunteering',
		name: 'Volunteering',
		icon: '&#x1F91D;',
		description: 'Volunteer or charity work',
		group: 'special'
	},
	// Travel Style
	{
		id: 'backpacking',
		name: 'Backpacking',
		icon: '&#x1F392;',
		description: 'Budget travel with a pack',
		group: 'travel_style'
	},
	{
		id: 'road_trip',
		name: 'Road Trip',
		icon: '&#x1F697;',
		description: 'Driving adventure',
		group: 'travel_style'
	},
	{
		id: 'digital_nomad',
		name: 'Digital Nomad',
		icon: '&#x1F4BB;',
		description: 'Remote work while traveling',
		group: 'travel_style'
	},
	{
		id: 'solo_travel',
		name: 'Solo Travel',
		icon: '&#x1F9CD;',
		description: 'Independent exploration',
		group: 'travel_style'
	}
];

export type Climate = 'tropical' | 'temperate' | 'cold' | 'arid' | 'mixed';

export const CATEGORIES = [
	'Clothing',
	'Footwear',
	'Toiletries & Hygiene',
	'Electronics & Gadgets',
	'Documents & Money',
	'Health & Medicine',
	'Travel Essentials',
	'Activity Gear',
	'Food & Drinks',
	'Comfort & Entertainment',
	'Kids & Family',
	'Work & Business'
] as const;

export type Category = (typeof CATEGORIES)[number];

const ESSENTIALS: PackingTemplateItem[] = [
	{ name: 'Passport', category: 'Documents & Money', quantity: 1 },
	{ name: 'Travel insurance documents', category: 'Documents & Money', quantity: 1 },
	{ name: 'Flight tickets / boarding passes', category: 'Documents & Money', quantity: 1 },
	{ name: 'Hotel / accommodation confirmation', category: 'Documents & Money', quantity: 1 },
	{ name: 'Credit / debit cards', category: 'Documents & Money', quantity: 2 },
	{ name: 'Local currency / cash', category: 'Documents & Money', quantity: 1 },
	{ name: 'Copies of important documents', category: 'Documents & Money', quantity: 1 },
	{ name: 'Phone charger', category: 'Electronics & Gadgets', quantity: 1 },
	{ name: 'Power bank', category: 'Electronics & Gadgets', quantity: 1 },
	{ name: 'Universal power adapter', category: 'Electronics & Gadgets', quantity: 1 },
	{ name: 'Headphones / earbuds', category: 'Electronics & Gadgets', quantity: 1 },
	{ name: 'Toothbrush', category: 'Toiletries & Hygiene', quantity: 1 },
	{ name: 'Toothpaste', category: 'Toiletries & Hygiene', quantity: 1 },
	{ name: 'Deodorant', category: 'Toiletries & Hygiene', quantity: 1 },
	{ name: 'Shampoo (travel size)', category: 'Toiletries & Hygiene', quantity: 1 },
	{ name: 'Body wash / soap', category: 'Toiletries & Hygiene', quantity: 1 },
	{ name: 'Razor', category: 'Toiletries & Hygiene', quantity: 1 },
	{ name: 'Prescription medications', category: 'Health & Medicine', quantity: 1 },
	{ name: 'Pain relievers (ibuprofen/paracetamol)', category: 'Health & Medicine', quantity: 1 },
	{ name: 'Band-aids / first aid basics', category: 'Health & Medicine', quantity: 1 },
	{ name: 'Hand sanitizer', category: 'Health & Medicine', quantity: 1 },
	{ name: 'Sunscreen', category: 'Toiletries & Hygiene', quantity: 1 },
	{ name: 'Lip balm with SPF', category: 'Toiletries & Hygiene', quantity: 1 },
	{ name: 'Underwear', category: 'Clothing', quantity: 7 },
	{ name: 'Socks', category: 'Clothing', quantity: 7 },
	{ name: 'T-shirts', category: 'Clothing', quantity: 5 },
	{ name: 'Pants / trousers', category: 'Clothing', quantity: 3 },
	{ name: 'Sleepwear / pajamas', category: 'Clothing', quantity: 2 },
	{ name: 'Comfortable walking shoes', category: 'Footwear', quantity: 1 },
	{ name: 'Reusable water bottle', category: 'Travel Essentials', quantity: 1 },
	{ name: 'Day bag / small backpack', category: 'Travel Essentials', quantity: 1 },
	{ name: 'Luggage locks', category: 'Travel Essentials', quantity: 2 },
	{ name: 'Packing cubes', category: 'Travel Essentials', quantity: 1 },
	{ name: 'Laundry bag', category: 'Travel Essentials', quantity: 1 },
	{ name: 'Travel pillow', category: 'Comfort & Entertainment', quantity: 1 },
	{ name: 'Eye mask', category: 'Comfort & Entertainment', quantity: 1 },
	{ name: 'Ear plugs', category: 'Comfort & Entertainment', quantity: 1 },
	{ name: 'Book / e-reader', category: 'Comfort & Entertainment', quantity: 1 }
];

const CLIMATE_ITEMS: Record<string, PackingTemplateItem[]> = {
	tropical: [
		{ name: 'Shorts', category: 'Clothing', quantity: 4 },
		{ name: 'Tank tops / light shirts', category: 'Clothing', quantity: 4 },
		{ name: 'Swimsuit', category: 'Clothing', quantity: 2 },
		{ name: 'Sandals / flip flops', category: 'Footwear', quantity: 1 },
		{ name: 'Sun hat / cap', category: 'Clothing', quantity: 1 },
		{ name: 'Sunglasses', category: 'Clothing', quantity: 1 },
		{ name: 'Light rain jacket', category: 'Clothing', quantity: 1 },
		{ name: 'Insect repellent', category: 'Health & Medicine', quantity: 1 },
		{ name: 'After-sun / aloe vera', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Light scarf / sarong', category: 'Clothing', quantity: 1 },
		{ name: 'Moisture-wicking underwear', category: 'Clothing', quantity: 3 }
	],
	temperate: [
		{ name: 'Light jacket / hoodie', category: 'Clothing', quantity: 1 },
		{ name: 'Long sleeve shirts', category: 'Clothing', quantity: 3 },
		{ name: 'Jeans / casual pants', category: 'Clothing', quantity: 2 },
		{ name: 'Light sweater', category: 'Clothing', quantity: 2 },
		{ name: 'Sunglasses', category: 'Clothing', quantity: 1 },
		{ name: 'Compact umbrella', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Layering pieces', category: 'Clothing', quantity: 2 }
	],
	cold: [
		{ name: 'Winter coat / down jacket', category: 'Clothing', quantity: 1 },
		{ name: 'Thermal underwear / base layers', category: 'Clothing', quantity: 3 },
		{ name: 'Warm sweaters / fleece', category: 'Clothing', quantity: 3 },
		{ name: 'Wool socks', category: 'Clothing', quantity: 5 },
		{ name: 'Winter boots', category: 'Footwear', quantity: 1 },
		{ name: 'Warm hat / beanie', category: 'Clothing', quantity: 1 },
		{ name: 'Gloves / mittens', category: 'Clothing', quantity: 1 },
		{ name: 'Scarf / neck warmer', category: 'Clothing', quantity: 1 },
		{ name: 'Hand warmers', category: 'Travel Essentials', quantity: 4 },
		{ name: 'Moisturizer (cold weather)', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Lip balm (extra)', category: 'Toiletries & Hygiene', quantity: 1 }
	],
	arid: [
		{ name: 'Lightweight long pants', category: 'Clothing', quantity: 3 },
		{ name: 'Long sleeve sun shirts', category: 'Clothing', quantity: 3 },
		{ name: 'Wide-brim sun hat', category: 'Clothing', quantity: 1 },
		{ name: 'Sunglasses (UV protection)', category: 'Clothing', quantity: 1 },
		{ name: 'Bandana / buff', category: 'Clothing', quantity: 2 },
		{ name: 'Extra sunscreen (high SPF)', category: 'Toiletries & Hygiene', quantity: 2 },
		{ name: 'Electrolyte packets', category: 'Health & Medicine', quantity: 6 },
		{ name: 'Extra water bottles', category: 'Travel Essentials', quantity: 2 },
		{ name: 'Light windbreaker', category: 'Clothing', quantity: 1 }
	],
	mixed: [
		{ name: 'Layerable clothing', category: 'Clothing', quantity: 4 },
		{ name: 'Light jacket', category: 'Clothing', quantity: 1 },
		{ name: 'Warm sweater', category: 'Clothing', quantity: 1 },
		{ name: 'Rain jacket', category: 'Clothing', quantity: 1 },
		{ name: 'Sunglasses', category: 'Clothing', quantity: 1 },
		{ name: 'Compact umbrella', category: 'Travel Essentials', quantity: 1 }
	]
};

const ACTIVITY_ITEMS: Record<string, PackingTemplateItem[]> = {
	hiking: [
		{ name: 'Hiking boots (broken in)', category: 'Footwear', quantity: 1 },
		{ name: 'Hiking socks (merino wool)', category: 'Clothing', quantity: 4 },
		{ name: 'Hiking pants (quick-dry)', category: 'Clothing', quantity: 2 },
		{ name: 'Moisture-wicking t-shirts', category: 'Clothing', quantity: 3 },
		{ name: 'Hiking backpack (30-50L)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Trekking poles', category: 'Activity Gear', quantity: 1 },
		{ name: 'Trail map / GPS device', category: 'Activity Gear', quantity: 1 },
		{ name: 'Headlamp', category: 'Activity Gear', quantity: 1 },
		{ name: 'Rain cover for backpack', category: 'Activity Gear', quantity: 1 },
		{ name: 'Blister prevention tape', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Energy bars / trail mix', category: 'Food & Drinks', quantity: 6 },
		{ name: 'Water purification tablets', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Gaiters', category: 'Activity Gear', quantity: 1 },
		{ name: 'Compass', category: 'Activity Gear', quantity: 1 },
		{ name: 'Emergency whistle', category: 'Activity Gear', quantity: 1 }
	],
	camping: [
		{ name: 'Tent', category: 'Activity Gear', quantity: 1 },
		{ name: 'Sleeping bag', category: 'Activity Gear', quantity: 1 },
		{ name: 'Sleeping pad / mat', category: 'Activity Gear', quantity: 1 },
		{ name: 'Camp stove', category: 'Activity Gear', quantity: 1 },
		{ name: 'Cooking pot / pan', category: 'Activity Gear', quantity: 1 },
		{ name: 'Utensils / mess kit', category: 'Activity Gear', quantity: 1 },
		{ name: 'Cooler / food storage', category: 'Activity Gear', quantity: 1 },
		{ name: 'Flashlight / lantern', category: 'Activity Gear', quantity: 1 },
		{ name: 'Fire starter / matches', category: 'Activity Gear', quantity: 1 },
		{ name: 'Multi-tool / knife', category: 'Activity Gear', quantity: 1 },
		{ name: 'Biodegradable soap', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Trash bags', category: 'Activity Gear', quantity: 3 },
		{ name: 'Rope / paracord', category: 'Activity Gear', quantity: 1 },
		{ name: 'Camp chair', category: 'Activity Gear', quantity: 1 },
		{ name: 'Insect repellent (DEET)', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Campfire grill grate', category: 'Activity Gear', quantity: 1 }
	],
	rock_climbing: [
		{ name: 'Climbing shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Climbing harness', category: 'Activity Gear', quantity: 1 },
		{ name: 'Chalk bag + chalk', category: 'Activity Gear', quantity: 1 },
		{ name: 'Belay device', category: 'Activity Gear', quantity: 1 },
		{ name: 'Carabiners', category: 'Activity Gear', quantity: 4 },
		{ name: 'Climbing rope', category: 'Activity Gear', quantity: 1 },
		{ name: 'Helmet', category: 'Activity Gear', quantity: 1 },
		{ name: 'Athletic tape', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Stretchy climbing pants', category: 'Clothing', quantity: 2 }
	],
	cycling: [
		{ name: 'Cycling shorts / bibs', category: 'Clothing', quantity: 3 },
		{ name: 'Cycling jerseys', category: 'Clothing', quantity: 3 },
		{ name: 'Cycling shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Helmet', category: 'Activity Gear', quantity: 1 },
		{ name: 'Cycling gloves', category: 'Activity Gear', quantity: 1 },
		{ name: 'Repair kit / tube patches', category: 'Activity Gear', quantity: 1 },
		{ name: 'Mini pump', category: 'Activity Gear', quantity: 1 },
		{ name: 'Bike lights (front + rear)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Chamois cream', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Cycling sunglasses', category: 'Activity Gear', quantity: 1 },
		{ name: 'Padded seat cover', category: 'Activity Gear', quantity: 1 }
	],
	safari: [
		{ name: 'Neutral-colored clothing (khaki/olive)', category: 'Clothing', quantity: 5 },
		{ name: 'Long pants (light material)', category: 'Clothing', quantity: 3 },
		{ name: 'Long sleeve shirts', category: 'Clothing', quantity: 3 },
		{ name: 'Binoculars', category: 'Activity Gear', quantity: 1 },
		{ name: 'Camera with zoom lens', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Extra camera batteries', category: 'Electronics & Gadgets', quantity: 2 },
		{ name: 'Extra memory cards', category: 'Electronics & Gadgets', quantity: 2 },
		{ name: 'Dust covers for electronics', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Malaria medication', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Heavy-duty insect repellent', category: 'Health & Medicine', quantity: 2 },
		{ name: 'Safari hat', category: 'Clothing', quantity: 1 },
		{ name: 'Closed-toe walking shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Lightweight rain poncho', category: 'Clothing', quantity: 1 }
	],
	fishing: [
		{ name: 'Fishing rod & reel', category: 'Activity Gear', quantity: 1 },
		{ name: 'Tackle box / lures', category: 'Activity Gear', quantity: 1 },
		{ name: 'Fishing line (extra)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Fishing hat', category: 'Clothing', quantity: 1 },
		{ name: 'Polarized sunglasses', category: 'Activity Gear', quantity: 1 },
		{ name: 'Waterproof boots / waders', category: 'Footwear', quantity: 1 },
		{ name: 'Fishing gloves', category: 'Activity Gear', quantity: 1 },
		{ name: 'Cooler for catch', category: 'Activity Gear', quantity: 1 },
		{ name: 'Fishing license', category: 'Documents & Money', quantity: 1 },
		{ name: 'Multi-tool / filleting knife', category: 'Activity Gear', quantity: 1 }
	],
	horseback: [
		{ name: 'Riding boots', category: 'Footwear', quantity: 1 },
		{ name: 'Riding pants / jodhpurs', category: 'Clothing', quantity: 2 },
		{ name: 'Riding helmet', category: 'Activity Gear', quantity: 1 },
		{ name: 'Riding gloves', category: 'Activity Gear', quantity: 1 },
		{ name: 'Long pants (sturdy material)', category: 'Clothing', quantity: 2 }
	],
	beach: [
		{ name: 'Swimsuits', category: 'Clothing', quantity: 3 },
		{ name: 'Beach towel', category: 'Activity Gear', quantity: 2 },
		{ name: 'Flip flops / sandals', category: 'Footwear', quantity: 1 },
		{ name: 'Beach cover-up', category: 'Clothing', quantity: 1 },
		{ name: 'Waterproof phone case', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Beach bag', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Snorkel mask', category: 'Activity Gear', quantity: 1 },
		{ name: 'Reef-safe sunscreen', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Sun umbrella / shade tent', category: 'Activity Gear', quantity: 1 },
		{ name: 'Water shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Aloe vera gel', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Cooler bag', category: 'Activity Gear', quantity: 1 }
	],
	scuba_diving: [
		{ name: 'Dive certification card (PADI/SSI)', category: 'Documents & Money', quantity: 1 },
		{ name: 'Dive log book', category: 'Activity Gear', quantity: 1 },
		{ name: 'Wetsuit', category: 'Activity Gear', quantity: 1 },
		{ name: 'Dive mask', category: 'Activity Gear', quantity: 1 },
		{ name: 'Fins', category: 'Activity Gear', quantity: 1 },
		{ name: 'Dive computer / watch', category: 'Activity Gear', quantity: 1 },
		{ name: 'Underwater camera', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Rash guard', category: 'Clothing', quantity: 2 },
		{ name: 'Reef-safe sunscreen', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Dry bag', category: 'Activity Gear', quantity: 1 },
		{ name: 'Defog solution', category: 'Activity Gear', quantity: 1 }
	],
	snorkeling: [
		{ name: 'Snorkel mask & snorkel', category: 'Activity Gear', quantity: 1 },
		{ name: 'Fins', category: 'Activity Gear', quantity: 1 },
		{ name: 'Rash guard', category: 'Clothing', quantity: 1 },
		{ name: 'Waterproof camera', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Reef-safe sunscreen', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Dry bag', category: 'Activity Gear', quantity: 1 },
		{ name: 'Water shoes', category: 'Footwear', quantity: 1 }
	],
	surfing: [
		{ name: 'Surfboard (or rent confirmation)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Wetsuit', category: 'Activity Gear', quantity: 1 },
		{ name: 'Surf wax', category: 'Activity Gear', quantity: 1 },
		{ name: 'Leash', category: 'Activity Gear', quantity: 1 },
		{ name: 'Rash guard', category: 'Clothing', quantity: 2 },
		{ name: 'Board shorts', category: 'Clothing', quantity: 3 },
		{ name: 'Reef booties', category: 'Footwear', quantity: 1 },
		{ name: 'Waterproof sunscreen (zinc)', category: 'Toiletries & Hygiene', quantity: 1 }
	],
	kayaking: [
		{ name: 'Quick-dry shorts', category: 'Clothing', quantity: 2 },
		{ name: 'Water shoes / sport sandals', category: 'Footwear', quantity: 1 },
		{ name: 'Dry bag', category: 'Activity Gear', quantity: 1 },
		{ name: 'Life jacket / PFD', category: 'Activity Gear', quantity: 1 },
		{ name: 'Waterproof phone case', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Paddling gloves', category: 'Activity Gear', quantity: 1 },
		{ name: 'Rash guard', category: 'Clothing', quantity: 1 },
		{ name: 'Spray skirt (for kayak)', category: 'Activity Gear', quantity: 1 }
	],
	cruise: [
		{ name: 'Formal dinner outfit', category: 'Clothing', quantity: 2 },
		{ name: 'Smart casual outfits', category: 'Clothing', quantity: 4 },
		{ name: 'Swimsuit', category: 'Clothing', quantity: 2 },
		{ name: 'Dress shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Lanyard for cruise card', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Motion sickness medication', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Magnetic hooks (for cabin)', category: 'Travel Essentials', quantity: 4 },
		{ name: 'Wrinkle-release spray', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Small fan (battery)', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'Waterproof bag for excursions', category: 'Travel Essentials', quantity: 1 }
	],
	sailing: [
		{ name: 'Sailing gloves', category: 'Activity Gear', quantity: 1 },
		{ name: 'Non-slip deck shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Waterproof jacket', category: 'Clothing', quantity: 1 },
		{ name: 'Quick-dry clothing', category: 'Clothing', quantity: 4 },
		{ name: 'Dry bag', category: 'Activity Gear', quantity: 1 },
		{ name: 'Motion sickness medication', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Safety harness tether', category: 'Activity Gear', quantity: 1 },
		{ name: 'Waterproof watch', category: 'Electronics & Gadgets', quantity: 1 }
	],
	skiing: [
		{ name: 'Ski jacket', category: 'Clothing', quantity: 1 },
		{ name: 'Ski pants', category: 'Clothing', quantity: 1 },
		{ name: 'Ski boots', category: 'Footwear', quantity: 1 },
		{ name: 'Skis + poles (or rental confirmation)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Ski goggles', category: 'Activity Gear', quantity: 1 },
		{ name: 'Ski helmet', category: 'Activity Gear', quantity: 1 },
		{ name: 'Ski gloves (waterproof)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Thermal base layers', category: 'Clothing', quantity: 3 },
		{ name: 'Neck gaiter / balaclava', category: 'Clothing', quantity: 1 },
		{ name: 'Ski socks', category: 'Clothing', quantity: 4 },
		{ name: 'Mid-layer fleece', category: 'Clothing', quantity: 2 },
		{ name: 'Hand / toe warmers', category: 'Travel Essentials', quantity: 6 },
		{ name: 'Lift pass holder', category: 'Activity Gear', quantity: 1 },
		{ name: 'Sunscreen (high altitude)', category: 'Toiletries & Hygiene', quantity: 1 }
	],
	snowboarding: [
		{ name: 'Snowboard jacket', category: 'Clothing', quantity: 1 },
		{ name: 'Snowboard pants', category: 'Clothing', quantity: 1 },
		{ name: 'Snowboard boots', category: 'Footwear', quantity: 1 },
		{ name: 'Snowboard + bindings (or rental)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Snowboard goggles', category: 'Activity Gear', quantity: 1 },
		{ name: 'Helmet', category: 'Activity Gear', quantity: 1 },
		{ name: 'Wrist guards', category: 'Activity Gear', quantity: 1 },
		{ name: 'Impact shorts', category: 'Activity Gear', quantity: 1 },
		{ name: 'Thermal base layers', category: 'Clothing', quantity: 3 },
		{ name: 'Neck gaiter', category: 'Clothing', quantity: 1 },
		{ name: 'Waterproof gloves', category: 'Activity Gear', quantity: 1 }
	],
	ice_skating: [
		{ name: 'Ice skates (or rental)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Warm socks (medium thickness)', category: 'Clothing', quantity: 2 },
		{ name: 'Gloves', category: 'Clothing', quantity: 1 },
		{ name: 'Warm but flexible clothing', category: 'Clothing', quantity: 2 },
		{ name: 'Helmet (for beginners)', category: 'Activity Gear', quantity: 1 }
	],
	snowshoeing: [
		{ name: 'Snowshoes (or rental)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Trekking poles (snow baskets)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Waterproof hiking boots', category: 'Footwear', quantity: 1 },
		{ name: 'Gaiters', category: 'Activity Gear', quantity: 1 },
		{ name: 'Thermal layers', category: 'Clothing', quantity: 3 },
		{ name: 'Waterproof outer layer', category: 'Clothing', quantity: 1 },
		{ name: 'Insulated water bottle', category: 'Travel Essentials', quantity: 1 }
	],
	city_break: [
		{ name: 'Smart casual outfits', category: 'Clothing', quantity: 4 },
		{ name: 'Comfortable walking shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Dressier shoes (for dining)', category: 'Footwear', quantity: 1 },
		{ name: 'City map / offline maps downloaded', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Transit card / pass', category: 'Documents & Money', quantity: 1 },
		{ name: 'Crossbody / anti-theft bag', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Compact umbrella', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Phrasebook / translation app', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Nice dinner outfit', category: 'Clothing', quantity: 1 }
	],
	museum_tour: [
		{ name: 'Comfortable walking shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Light jacket (AC in museums)', category: 'Clothing', quantity: 1 },
		{ name: 'Small notebook / journal', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'Camera (no flash)', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Museum pass / tickets', category: 'Documents & Money', quantity: 1 }
	],
	food_tour: [
		{ name: 'Comfortable walking shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Stretchy / loose pants', category: 'Clothing', quantity: 2 },
		{ name: 'Antacids / digestive aids', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Hand wipes / sanitizer', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Food allergy card (local language)', category: 'Documents & Money', quantity: 1 },
		{ name: 'Reusable utensils', category: 'Travel Essentials', quantity: 1 }
	],
	photography: [
		{ name: 'Camera body', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Lenses (wide, telephoto, prime)', category: 'Electronics & Gadgets', quantity: 3 },
		{ name: 'Tripod', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Extra batteries', category: 'Electronics & Gadgets', quantity: 3 },
		{ name: 'Memory cards', category: 'Electronics & Gadgets', quantity: 4 },
		{ name: 'Lens cleaning kit', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Camera bag (padded)', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'External hard drive', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Filters (ND, polarizer)', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Remote shutter release', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Rain cover for camera', category: 'Electronics & Gadgets', quantity: 1 }
	],
	nightlife: [
		{ name: 'Going-out outfits', category: 'Clothing', quantity: 3 },
		{ name: 'Dress shoes / heels', category: 'Footwear', quantity: 1 },
		{ name: 'Small clutch / wallet', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Touch-up makeup / grooming kit', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Earplugs (for loud venues)', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Phone with offline maps', category: 'Electronics & Gadgets', quantity: 1 }
	],
	cultural_religious: [
		{ name: 'Modest clothing (covers shoulders/knees)', category: 'Clothing', quantity: 4 },
		{ name: 'Head covering / scarf', category: 'Clothing', quantity: 1 },
		{ name: 'Slip-on shoes (easy removal)', category: 'Footwear', quantity: 1 },
		{ name: 'Small donation / offering money', category: 'Documents & Money', quantity: 1 },
		{ name: 'Guidebook on local customs', category: 'Comfort & Entertainment', quantity: 1 }
	],
	spa_wellness: [
		{ name: 'Robe (or plan to use provided)', category: 'Clothing', quantity: 1 },
		{ name: 'Swimsuit', category: 'Clothing', quantity: 2 },
		{ name: 'Comfortable loungewear', category: 'Clothing', quantity: 3 },
		{ name: 'Flip flops / slippers', category: 'Footwear', quantity: 1 },
		{ name: 'Hair ties / clips', category: 'Toiletries & Hygiene', quantity: 3 },
		{ name: 'Minimal makeup / skincare', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Journal / reading material', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'Reusable water bottle', category: 'Travel Essentials', quantity: 1 }
	],
	yoga_retreat: [
		{ name: 'Yoga mat (or check if provided)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Yoga pants / leggings', category: 'Clothing', quantity: 4 },
		{ name: 'Comfortable tops', category: 'Clothing', quantity: 4 },
		{ name: 'Meditation cushion', category: 'Activity Gear', quantity: 1 },
		{ name: 'Journal', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'Light shawl / blanket', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'Reusable water bottle', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Natural toiletries', category: 'Toiletries & Hygiene', quantity: 1 }
	],
	golf: [
		{ name: 'Golf clubs (or rental)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Golf shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Golf glove', category: 'Activity Gear', quantity: 1 },
		{ name: 'Golf balls', category: 'Activity Gear', quantity: 12 },
		{ name: 'Collared shirts / polo', category: 'Clothing', quantity: 4 },
		{ name: 'Golf pants / shorts', category: 'Clothing', quantity: 3 },
		{ name: 'Golf cap / visor', category: 'Clothing', quantity: 1 },
		{ name: 'Tees & ball markers', category: 'Activity Gear', quantity: 1 },
		{ name: 'Rangefinder', category: 'Activity Gear', quantity: 1 }
	],
	resort: [
		{ name: 'Resort-casual outfits', category: 'Clothing', quantity: 5 },
		{ name: 'Swimsuits', category: 'Clothing', quantity: 3 },
		{ name: 'Cover-up / sarong', category: 'Clothing', quantity: 2 },
		{ name: 'Dinner outfit (smart casual)', category: 'Clothing', quantity: 2 },
		{ name: 'Sandals', category: 'Footwear', quantity: 1 },
		{ name: 'Sun hat', category: 'Clothing', quantity: 1 },
		{ name: 'Pool / beach towel clip', category: 'Travel Essentials', quantity: 2 },
		{ name: 'Waterproof book / e-reader', category: 'Comfort & Entertainment', quantity: 1 }
	],
	business: [
		{ name: 'Business suits / blazers', category: 'Clothing', quantity: 2 },
		{ name: 'Dress shirts', category: 'Clothing', quantity: 4 },
		{ name: 'Dress pants / skirts', category: 'Clothing', quantity: 3 },
		{ name: 'Ties / accessories', category: 'Clothing', quantity: 2 },
		{ name: 'Dress shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Laptop + charger', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Business cards', category: 'Work & Business', quantity: 1 },
		{ name: 'Portfolio / notebook', category: 'Work & Business', quantity: 1 },
		{ name: 'Presentation clicker', category: 'Work & Business', quantity: 1 },
		{ name: 'Portable mouse', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'USB drive', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Garment bag', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Wrinkle-release spray', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Shoe polish / shine kit', category: 'Toiletries & Hygiene', quantity: 1 }
	],
	wedding: [
		{ name: 'Formal outfit (suit/dress)', category: 'Clothing', quantity: 1 },
		{ name: 'Backup formal outfit', category: 'Clothing', quantity: 1 },
		{ name: 'Dress shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Comfortable shoes (for dancing)', category: 'Footwear', quantity: 1 },
		{ name: 'Garment bag', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Gift / card', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Jewelry / accessories', category: 'Clothing', quantity: 1 },
		{ name: 'Steamer / wrinkle spray', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Stain remover pen', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Fashion tape / sewing kit', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Makeup / grooming products', category: 'Toiletries & Hygiene', quantity: 1 }
	],
	festival: [
		{ name: 'Festival outfits', category: 'Clothing', quantity: 4 },
		{ name: 'Comfortable boots / shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Rain boots / wellies', category: 'Footwear', quantity: 1 },
		{ name: 'Rain poncho', category: 'Clothing', quantity: 2 },
		{ name: 'Fanny pack / crossbody bag', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Earplugs (concert grade)', category: 'Health & Medicine', quantity: 2 },
		{ name: 'Portable phone charger', category: 'Electronics & Gadgets', quantity: 2 },
		{ name: 'Tent + sleeping bag (if camping)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Wet wipes / dry shampoo', category: 'Toiletries & Hygiene', quantity: 3 },
		{ name: 'Bandana / hat', category: 'Clothing', quantity: 1 },
		{ name: 'Cash (small bills)', category: 'Documents & Money', quantity: 1 },
		{ name: 'Sunglasses (cheap/durable)', category: 'Clothing', quantity: 1 },
		{ name: 'Trash bags (for wet/dirty clothes)', category: 'Travel Essentials', quantity: 3 },
		{ name: 'Flags / totems (find friends)', category: 'Activity Gear', quantity: 1 }
	],
	family_vacation: [
		{ name: 'Kids clothing (extra)', category: 'Kids & Family', quantity: 7 },
		{ name: 'Kids pajamas', category: 'Kids & Family', quantity: 2 },
		{ name: 'Kids shoes (comfortable)', category: 'Kids & Family', quantity: 2 },
		{ name: 'Car seats / boosters', category: 'Kids & Family', quantity: 1 },
		{ name: 'Stroller (travel-size)', category: 'Kids & Family', quantity: 1 },
		{ name: 'Kids sunscreen', category: 'Kids & Family', quantity: 1 },
		{ name: 'Snacks & treats', category: 'Kids & Family', quantity: 1 },
		{ name: 'Coloring books / activities', category: 'Kids & Family', quantity: 1 },
		{ name: 'Tablet + charger (loaded with content)', category: 'Kids & Family', quantity: 1 },
		{ name: 'Kid-friendly headphones', category: 'Kids & Family', quantity: 1 },
		{ name: 'Favorite toy / comfort item', category: 'Kids & Family', quantity: 1 },
		{ name: "Children's medicine", category: 'Kids & Family', quantity: 1 },
		{ name: 'Baby wipes', category: 'Kids & Family', quantity: 2 },
		{ name: 'Diapers (if needed)', category: 'Kids & Family', quantity: 1 },
		{ name: 'Sippy cups / water bottles', category: 'Kids & Family', quantity: 2 },
		{ name: 'Portable night light', category: 'Kids & Family', quantity: 1 }
	],
	honeymoon: [
		{ name: 'Romantic outfits', category: 'Clothing', quantity: 4 },
		{ name: 'Nice dinner outfits', category: 'Clothing', quantity: 3 },
		{ name: 'Swimsuit', category: 'Clothing', quantity: 3 },
		{ name: 'Lingerie', category: 'Clothing', quantity: 3 },
		{ name: 'Dress shoes', category: 'Footwear', quantity: 1 },
		{ name: 'Camera / GoPro', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Travel journal', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'Special occasion accessories', category: 'Clothing', quantity: 1 },
		{ name: 'Couples activity reservations', category: 'Documents & Money', quantity: 1 }
	],
	study_abroad: [
		{ name: 'Laptop + charger', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'School supplies / notebooks', category: 'Work & Business', quantity: 1 },
		{ name: 'Textbooks / course materials', category: 'Work & Business', quantity: 1 },
		{ name: 'Student ID / enrollment docs', category: 'Documents & Money', quantity: 1 },
		{ name: 'Visa documents', category: 'Documents & Money', quantity: 1 },
		{ name: 'Housing confirmation', category: 'Documents & Money', quantity: 1 },
		{ name: 'Extended wardrobe (2+ weeks)', category: 'Clothing', quantity: 10 },
		{
			name: 'Bedding / pillow (if not provided)',
			category: 'Comfort & Entertainment',
			quantity: 1
		},
		{
			name: 'Kitchen essentials (cup, plate, utensils)',
			category: 'Travel Essentials',
			quantity: 1
		},
		{ name: 'Laundry detergent (travel)', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Photos of home / comfort items', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'International student card (ISIC)', category: 'Documents & Money', quantity: 1 }
	],
	volunteering: [
		{ name: 'Work clothing (can get dirty)', category: 'Clothing', quantity: 5 },
		{ name: 'Sturdy work boots', category: 'Footwear', quantity: 1 },
		{ name: 'Work gloves', category: 'Activity Gear', quantity: 1 },
		{ name: 'Organization documents / ID', category: 'Documents & Money', quantity: 1 },
		{ name: 'Reusable water bottle', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Gifts for host community', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Portable water filter', category: 'Health & Medicine', quantity: 1 },
		{ name: 'Bug net (if rural)', category: 'Health & Medicine', quantity: 1 }
	],
	backpacking: [
		{ name: 'Backpack (40-65L)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Pack cover (waterproof)', category: 'Activity Gear', quantity: 1 },
		{ name: 'Quick-dry clothing', category: 'Clothing', quantity: 4 },
		{ name: 'Merino wool base layers', category: 'Clothing', quantity: 2 },
		{ name: 'Compact microfiber towel', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Hostel lock / padlock', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Sleep sheet / liner', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Clothesline', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Sink stopper (for hand washing)', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Travel laundry soap', category: 'Toiletries & Hygiene', quantity: 1 },
		{ name: 'Carabiners', category: 'Travel Essentials', quantity: 2 },
		{ name: 'Lightweight flip flops (hostels)', category: 'Footwear', quantity: 1 },
		{ name: 'Head torch', category: 'Activity Gear', quantity: 1 },
		{ name: 'Copies of docs (digital & paper)', category: 'Documents & Money', quantity: 1 }
	],
	road_trip: [
		{ name: 'Driver license', category: 'Documents & Money', quantity: 1 },
		{ name: 'Car insurance / registration', category: 'Documents & Money', quantity: 1 },
		{ name: 'Car phone mount', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Car charger (USB)', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'AUX cable / Bluetooth adapter', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Cooler with drinks & snacks', category: 'Food & Drinks', quantity: 1 },
		{ name: 'Paper towels / wet wipes', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Garbage bags', category: 'Travel Essentials', quantity: 3 },
		{ name: 'Blanket / pillow', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'Roadside emergency kit', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Playlist / podcasts downloaded', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'Cash for tolls', category: 'Documents & Money', quantity: 1 },
		{ name: 'Sunglasses', category: 'Clothing', quantity: 1 }
	],
	digital_nomad: [
		{ name: 'Laptop + charger', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Portable monitor', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Laptop stand', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Wireless mouse + keyboard', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Noise-canceling headphones', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Webcam (if needed)', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'USB-C hub / dongles', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Portable WiFi hotspot / eSIM', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Extension cord / power strip', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Cable organizer', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'VPN subscription (active)', category: 'Documents & Money', quantity: 1 },
		{ name: 'Ergonomic wrist rest', category: 'Comfort & Entertainment', quantity: 1 }
	],
	solo_travel: [
		{ name: 'Anti-theft backpack / bag', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Door stop alarm', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Personal safety alarm', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Offline maps downloaded', category: 'Electronics & Gadgets', quantity: 1 },
		{ name: 'Emergency contacts card', category: 'Documents & Money', quantity: 1 },
		{ name: 'Money belt / hidden pouch', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Journal / diary', category: 'Comfort & Entertainment', quantity: 1 },
		{ name: 'Portable door lock', category: 'Travel Essentials', quantity: 1 },
		{ name: 'Mini flashlight', category: 'Travel Essentials', quantity: 1 }
	]
};

export function getPackingListForTrip(
	activities: string[],
	climate: string
): PackingTemplateItem[] {
	const itemMap = new Map<string, PackingTemplateItem>();

	const addItems = (items: PackingTemplateItem[]) => {
		for (const item of items) {
			const key = item.name.toLowerCase();
			const existing = itemMap.get(key);
			if (existing) {
				if (item.quantity > existing.quantity) {
					itemMap.set(key, item);
				}
			} else {
				itemMap.set(key, item);
			}
		}
	};

	addItems(ESSENTIALS);

	const climateItems = CLIMATE_ITEMS[climate];
	if (climateItems) {
		addItems(climateItems);
	}

	for (const activity of activities) {
		const activityItems = ACTIVITY_ITEMS[activity];
		if (activityItems) {
			addItems(activityItems);
		}
	}

	return Array.from(itemMap.values()).sort((a, b) => {
		const catOrder =
			CATEGORIES.indexOf(a.category as Category) - CATEGORIES.indexOf(b.category as Category);
		if (catOrder !== 0) return catOrder;
		return a.name.localeCompare(b.name);
	});
}

export const CLIMATE_OPTIONS = [
	{ id: 'tropical', name: 'Tropical', description: 'Hot & humid, beaches, rainforests' },
	{ id: 'temperate', name: 'Temperate', description: 'Mild, seasonal, comfortable' },
	{ id: 'cold', name: 'Cold', description: 'Snow, freezing temps, winter' },
	{ id: 'arid', name: 'Arid / Desert', description: 'Hot & dry, extreme sun' },
	{ id: 'mixed', name: 'Mixed', description: 'Variable weather, pack for everything' }
] as const;
