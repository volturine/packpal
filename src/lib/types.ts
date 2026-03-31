export interface AuthUser {
	id: string;
	username: string;
	displayName: string;
}

export interface Trip {
	id: string;
	userId: string;
	name: string;
	destination: string;
	country: string | null;
	startDate: number;
	endDate: number;
	activities: string[];
	climate: 'tropical' | 'temperate' | 'cold' | 'arid' | 'mixed';
	travelers: number;
	notes: string | null;
	createdAt: number;
	archivedAt: number | null;
	itemCount?: number;
	packedCount?: number;
	criticalUnpackedCount?: number;
	isShared?: boolean;
	ownerDisplayName?: string;
	collaboratorCount?: number;
	tripStatus?: 'upcoming' | 'active' | 'completed';
	countdownLabel?: string | null;
	reminder?: ReminderSummary | null;
	contradictions?: TripContradiction[];
	collaborators?: TripCollaborator[];
}

export interface ReminderSummary {
	label: string;
	tone: 'info' | 'warning' | 'urgent';
}

export interface TripContradiction {
	message: string;
	severity: 'warning' | 'info';
}

export type PackingItemPriority = 'must' | 'normal' | 'optional';

export interface PackingItem {
	id: string;
	tripId: string;
	userId: string;
	name: string;
	category: string;
	packed: boolean;
	quantity: number;
	isCustom: boolean;
	notes: string | null;
	priority: PackingItemPriority;
}

export interface ChatMessage {
	id: string;
	tripId: string;
	userId: string;
	role: 'user' | 'assistant';
	content: string;
	createdAt: number;
}

export interface TripCollaborator {
	id: string;
	tripId: string;
	userId: string;
	username: string;
	displayName: string;
	invitedByUserId: string;
	createdAt: number;
}

export interface PackingPresetItem {
	name: string;
	category: string;
	quantity: number;
	notes: string | null;
	priority: PackingItemPriority;
}

export interface PackingPreset {
	id: string;
	userId: string;
	name: string;
	items: PackingPresetItem[];
	createdAt: number;
	lastUsedAt: number | null;
}
