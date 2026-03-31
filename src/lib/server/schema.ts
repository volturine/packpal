import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	displayName: text('display_name').notNull(),
	createdAt: integer('created_at', { mode: 'number' }).notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'number' }).notNull()
});

export const trips = sqliteTable('trips', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	destination: text('destination').notNull(),
	country: text('country'),
	startDate: integer('start_date', { mode: 'number' }).notNull(),
	endDate: integer('end_date', { mode: 'number' }).notNull(),
	activities: text('activities', { mode: 'json' }).notNull().$type<string[]>(),
	climate: text('climate', { enum: ['tropical', 'temperate', 'cold', 'arid', 'mixed'] }).notNull(),
	travelers: integer('travelers').notNull(),
	notes: text('notes'),
	archivedAt: integer('archived_at', { mode: 'number' }),
	createdAt: integer('created_at', { mode: 'number' }).notNull()
});

export const packingItems = sqliteTable('packing_items', {
	id: text('id').primaryKey(),
	tripId: text('trip_id')
		.notNull()
		.references(() => trips.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	category: text('category').notNull(),
	packed: integer('packed', { mode: 'boolean' }).notNull().default(false),
	quantity: integer('quantity').notNull().default(1),
	isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
	notes: text('notes'),
	priority: text('priority', { enum: ['must', 'normal', 'optional'] })
		.notNull()
		.default('normal')
});

export const tripCollaborators = sqliteTable('trip_collaborators', {
	id: text('id').primaryKey(),
	tripId: text('trip_id')
		.notNull()
		.references(() => trips.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	invitedByUserId: text('invited_by_user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'number' }).notNull()
});

export const packingPresets = sqliteTable('packing_presets', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	items: text('items', { mode: 'json' }).notNull().$type<
		{
			name: string;
			category: string;
			quantity: number;
			notes: string | null;
			priority: 'must' | 'normal' | 'optional';
		}[]
	>(),
	createdAt: integer('created_at', { mode: 'number' }).notNull(),
	lastUsedAt: integer('last_used_at', { mode: 'number' })
});

export const chatMessages = sqliteTable('chat_messages', {
	id: text('id').primaryKey(),
	tripId: text('trip_id')
		.notNull()
		.references(() => trips.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	role: text('role', { enum: ['user', 'assistant'] }).notNull(),
	content: text('content').notNull(),
	createdAt: integer('created_at', { mode: 'number' }).notNull()
});
