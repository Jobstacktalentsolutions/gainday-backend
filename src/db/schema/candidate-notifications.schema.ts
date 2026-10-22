import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';
import { jobSeekerProfiles } from './job-seeker-profiles.schema';

export const CandidateNotificationType = {
  SELECTED: 'SELECTED',
  JOB_RECOMMENDATION: 'JOB_RECOMMENDATION',
} as const;
export type CandidateNotificationType =
  (typeof CandidateNotificationType)[keyof typeof CandidateNotificationType];

/** In-app notifications for a single candidate, each with its own read state (unlike
 *  admin_notifications, which the whole admin team shares). */
export const candidateNotifications = pgTable(
  'candidate_notifications',
  {
    ...baseColumns,
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => jobSeekerProfiles.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 100 })
      .notNull()
      .$type<CandidateNotificationType>(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    /** Ids of what the notification is about, e.g. { submissionId, jobId }. */
    metadata: jsonb('metadata').$type<Record<string, string>>(),
    /** Null while unread. */
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [
    index('candidate_notifications_candidate_created_idx').on(
      table.candidateId,
      table.createdAt,
    ),
  ],
);

export type CandidateNotification = typeof candidateNotifications.$inferSelect;
