import { pgTable, varchar, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const flows = pgTable('flows', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const steps = pgTable('steps', {
  id: varchar('id', { length: 255 }).primaryKey(),
  flowId: varchar('flow_id', { length: 255 })
    .notNull()
    .references(() => flows.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  targetSelector: text('target_selector'),
  placement: varchar('placement', { length: 50 }).default('bottom').notNull(),
  stepIndex: integer('step_index').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable('events', {
  id: varchar('id', { length: 255 }).primaryKey(),
  flowId: varchar('flow_id', { length: 255 })
    .notNull()
    .references(() => flows.id, { onDelete: 'cascade' }),
  stepId: varchar('step_id', { length: 255 }).references(() => steps.id, { onDelete: 'set null' }),
  eventType: varchar('event_type', { length: 50 }).notNull(), // 'started' | 'completed' | 'skipped' | 'step_view'
  userId: varchar('user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
