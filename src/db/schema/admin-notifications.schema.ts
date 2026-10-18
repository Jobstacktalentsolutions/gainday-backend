import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';

export const adminNotificationSeverityEnum = pgEnum(
  'admin_notification_severity',
  ['INFO', 'WARNING', 'CRITICAL'],
);

export const AdminNotificationSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;
export type AdminNotificationSeverity =
  (typeof AdminNotificationSeverity)[keyof typeof AdminNotificationSeverity];

/** In-app notifications for the admin portal. Shared by every admin (no per-admin read state):
 *  one admin marking one read marks it read for the team, like support inquiries. */
export const adminNotifications = pgTable(
  'admin_notifications',
  {
    ...baseColumns,
    severity: adminNotificationSeverityEnum('severity')
      .notNull()
      .$type<AdminNotificationSeverity>(),
    /** Machine-readable kind, e.g. 'GRADING_FAILED'. */
    type: varchar('type', { length: 100 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    /** The failure reason (or other technical detail) attached to the notification. */
    details: text('details'),
    /** Ids of what the notification is about, e.g. { jobId, submissionId }. */
    metadata: jsonb('metadata').$type<Record<string, string>>(),
    /** Null while unread. */
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [index('admin_notifications_created_at_idx').on(table.createdAt)],
);

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type NewAdminNotification = typeof adminNotifications.$inferInsert;
