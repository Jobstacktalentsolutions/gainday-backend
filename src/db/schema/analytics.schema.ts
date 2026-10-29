import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Who a visitor was on a given day. A signed-in visitor takes their role; everyone else is anonymous. */
export const Audience = {
  ANONYMOUS: 'ANONYMOUS',
  JOB_SEEKER: 'JOB_SEEKER',
  EMPLOYER: 'EMPLOYER',
} as const;
export type Audience = (typeof Audience)[keyof typeof Audience];

export const analyticsAudienceEnum = pgEnum('analytics_audience', [
  Audience.ANONYMOUS,
  Audience.JOB_SEEKER,
  Audience.EMPLOYER,
]);

/** One row per visitor ever seen. The id is the first-party visitor id the frontend generates. */
export const visitors = pgTable('visitors', {
  id: uuid('id').primaryKey(),
  /** Latest signed-in user seen on this visitor. Null while the visitor has only been anonymous. */
  userId: uuid('user_id'),
  firstSeenOn: date('first_seen_on').notNull(),
  lastSeenOn: date('last_seen_on').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** One row per visitor per London day they were active. Source for DAU and MAU. */
export const visitorDailyActivity = pgTable(
  'visitor_daily_activity',
  {
    day: date('day').notNull(),
    visitorId: uuid('visitor_id')
      .notNull()
      .references(() => visitors.id, { onDelete: 'cascade' }),
    userId: uuid('user_id'),
    audience: analyticsAudienceEnum('audience').notNull().$type<Audience>(),
    sessions: integer('sessions').notNull(),
    pageViews: integer('page_views').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.day, table.visitorId] }),
    index('visitor_daily_activity_user_day_idx').on(table.userId, table.day),
    index('visitor_daily_activity_audience_day_idx').on(
      table.audience,
      table.day,
    ),
  ],
);

/** One row per London day, written by the end-of-day sync. Source for the overview history. */
export const dailyVisitorStats = pgTable('daily_visitor_stats', {
  day: date('day').primaryKey(),
  visitors: integer('visitors').notNull(),
  /** Signed-in visitors of any role. Kept with the per-audience counts for history. */
  signedInUsers: integer('signed_in_users').notNull(),
  anonymousVisitors: integer('anonymous_visitors').notNull(),
  jobSeekerVisitors: integer('job_seeker_visitors').notNull(),
  employerVisitors: integer('employer_visitors').notNull(),
  newVisitors: integer('new_visitors').notNull(),
  sessions: integer('sessions').notNull(),
  pageViews: integer('page_views').notNull(),
  rolling30dVisitors: integer('rolling_30d_visitors').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type DailyVisitorStats = typeof dailyVisitorStats.$inferSelect;
