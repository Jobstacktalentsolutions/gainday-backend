import { relations, sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';
import { users } from './users.schema';

/**
 * One experience rating per user (candidates and employers), 1 to 5 stars. `comment` is only
 * asked for on low ratings, so it is optional. Rows are written once and never edited.
 */
export const experienceReviews = pgTable(
  'experience_reviews',
  {
    ...baseColumns,
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
  },
  (table) => [
    check('experience_reviews_rating_range', sql`${table.rating} BETWEEN 1 AND 5`),
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
