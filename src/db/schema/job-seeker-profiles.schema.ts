import { jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { users } from './users.schema';
import { submissions } from './submissions.schema';

export interface CapabilityScores {
  [domain: string]: {
    score: number;
    updatedAt: string;
    categories: {
      problemSolving: number;
      judgmentExecution: number;
      writtenCommunication: number;
      commercialDomainAwareness: number;
    };
  };
}

export const jobSeekerProfiles = pgTable('job_seeker_profiles', {
  ...baseColumns,
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }),
  capabilityScores: jsonb('capability_scores').$type<CapabilityScores>(),
});

export const jobSeekerProfilesRelations = relations(
  jobSeekerProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [jobSeekerProfiles.userId],
      references: [users.id],
    }),
    submissions: many(submissions),
  }),
);

export type JobSeekerProfile = typeof jobSeekerProfiles.$inferSelect;
export type NewJobSeekerProfile = typeof jobSeekerProfiles.$inferInsert;
