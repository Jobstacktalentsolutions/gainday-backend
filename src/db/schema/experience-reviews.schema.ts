import { relations, sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';
import { users } from './users.schema';
import { submissions } from './submissions.schema';

/**
 * One experience rating per assessment a candidate completes, 1 to 5 stars. The rating is linked
 * to the submission it was given for, so `submissionId` is unique: a submission gets one rating.
 * `comment` is only asked for on low ratings, so it is optional. Rows are written once and never
 * edited. `submissionId` is set null if the submission is deleted, keeping the rating itself.
 */
export const experienceReviews = pgTable(
  'experience_reviews',
  {
    ...baseColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    submissionId: uuid('submission_id')
      .unique()
      .references(() => submissions.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
  },
  (table) => [
    check('experience_reviews_rating_range', sql`${table.rating} BETWEEN 1 AND 5`),
    index('experience_reviews_user_id_idx').on(table.userId),
    index('experience_reviews_created_at_idx').on(table.createdAt),
  ],
);

export const experienceReviewsRelations = relations(experienceReviews, ({ one }) => ({
  user: one(users, {
    fields: [experienceReviews.userId],
    references: [users.id],
  }),
}));

export type ExperienceReview = typeof experienceReviews.$inferSelect;
export type NewExperienceReview = typeof experienceReviews.$inferInsert;
