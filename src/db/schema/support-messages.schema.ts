import {
  pgTable,
  text,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';

export const supportMessages = pgTable('support_messages', {
  ...baseColumns,
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  topic: varchar('topic', { length: 100 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
});

export type SupportMessage = typeof supportMessages.$inferSelect;
export type NewSupportMessage = typeof supportMessages.$inferInsert;
