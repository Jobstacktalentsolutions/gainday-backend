import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { users } from './users.schema';
import { jobs } from './jobs.schema';

export const employerProfiles = pgTable('employer_profiles', {
  ...baseColumns,
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  companyName: varchar('company_name', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 50 }),
});

export const employerProfilesRelations = relations(
  employerProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [employerProfiles.userId],
      references: [users.id],
    }),
    jobs: many(jobs),
  }),
);

export type EmployerProfile = typeof employerProfiles.$inferSelect;
export type NewEmployerProfile = typeof employerProfiles.$inferInsert;
