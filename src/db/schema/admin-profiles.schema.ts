import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { users } from './users.schema';
import { generationReviewItems } from './generation-review.schema';

export const adminProfiles = pgTable('admin_profiles', {
  ...baseColumns,
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
});

export const adminProfilesRelations = relations(
  adminProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [adminProfiles.userId],
      references: [users.id],
    }),
    reviewedItems: many(generationReviewItems),
  }),
);

export type AdminProfile = typeof adminProfiles.$inferSelect;
export type NewAdminProfile = typeof adminProfiles.$inferInsert;
