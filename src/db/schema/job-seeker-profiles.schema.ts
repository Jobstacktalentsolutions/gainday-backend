import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
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

/**
 * Cached LLM-generated narrative for the candidate's capability passport (CapabilityPassportService).
 * Generated lazily, only when `basedOnSubmissionIds` (the candidate's last 3 graded submission
 * ids) no longer matches what's currently graded — see PassportNarrativeService. Kept here rather
 * than recomputed on every request, since it's an LLM call, not a derived calculation.
 */
export interface PassportNarrative {
  whatStoodOut: string;
  improvementSuggestions: {
    id: string;
    area:
      | 'problemSolving'
      | 'judgmentExecution'
      | 'writtenCommunication'
      | 'commercialDomainAwareness'
      | 'OVERALL';
    text: string;
  }[];
  basedOnSubmissionIds: string[];
  generatedAt: string;
}

export const genderEnum = pgEnum('gender', ['MALE', 'FEMALE', 'NON_BINARY']);
export const pronounsEnum = pgEnum('pronouns', [
  'HE_HIM',
  'SHE_HER',
  'THEY_THEM',
]);

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  NON_BINARY: 'NON_BINARY',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const Pronouns = {
  HE_HIM: 'HE_HIM',
  SHE_HER: 'SHE_HER',
  THEY_THEM: 'THEY_THEM',
} as const;
export type Pronouns = (typeof Pronouns)[keyof typeof Pronouns];

export const jobSeekerProfiles = pgTable('job_seeker_profiles', {
  ...baseColumns,
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }),
  // All optional at the DB level; the app requires `pronouns` before a candidate can apply, and
  // `isProfileComplete` records that it has been filled (see JobSeekerProfileService.update).
  gender: genderEnum('gender').$type<Gender>(),
  pronouns: pronounsEnum('pronouns').$type<Pronouns>(),
  brief: text('brief'),
  isProfileComplete: boolean('is_profile_complete').notNull().default(false),
  capabilityScores: jsonb('capability_scores').$type<CapabilityScores>(),
  passportNarrative: jsonb('passport_narrative').$type<PassportNarrative>(),
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
