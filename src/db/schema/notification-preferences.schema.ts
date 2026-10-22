import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';
import { users } from './users.schema';

/**
 * Email opt-outs for one user. A missing row means every category is enabled, so rows are only
 * written once a user changes a setting or an email needs its unsubscribe link.
 *
 * `unsubscribeToken` is the credential behind the unsubscribe link, so a recipient can change
 * these settings without signing in.
 */
export const notificationPreferences = pgTable('notification_preferences', {
  ...baseColumns,
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  jobRecommendationsEnabled: boolean('job_recommendations_enabled')
    .notNull()
    .default(true),
  newsletterEnabled: boolean('newsletter_enabled').notNull().default(true),
  unsubscribeToken: varchar('unsubscribe_token', { length: 64 })
    .notNull()
    .unique(),
});

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
