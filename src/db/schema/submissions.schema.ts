import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { jobs } from './jobs.schema';
import { simulations } from './simulations.schema';
import { jobSeekerProfiles } from './job-seeker-profiles.schema';

export const submissionStatusEnum = pgEnum('submission_status', [
  'PENDING',
  'SCORING',
  'SCORED',
  'DISQUALIFIED',
]);

export const SubmissionStatus = {
  PENDING: 'PENDING',
  SCORING: 'SCORING',
  SCORED: 'SCORED',
  DISQUALIFIED: 'DISQUALIFIED',
} as const;
export type SubmissionStatus =
  (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export interface CandidateAnswer {
  taskId: string;
  responseBody: string;
  timeSpentSeconds: number;
}

export interface CategoryScoreDetail {
  score: number;
  rationale: string;
  evidence: string;
}

export interface CategoryScores {
  problemSolving: CategoryScoreDetail;
  judgmentExecution: CategoryScoreDetail;
  writtenCommunication: CategoryScoreDetail;
  commercialDomainAwareness: CategoryScoreDetail;
}

export interface GuestInfo {
  fullName: string;
  email: string;
  phoneNumber?: string;
}

export const submissions = pgTable('submissions', {
  ...baseColumns,
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  simulationId: uuid('simulation_id')
    .notNull()
    .references(() => simulations.id),
  candidateId: uuid('candidate_id').references(() => jobSeekerProfiles.id, {
    onDelete: 'set null',
  }),
  guestInfo: jsonb('guest_info').$type<GuestInfo>(),
  status: submissionStatusEnum('status')
    .notNull()
    .default('PENDING')
    .$type<SubmissionStatus>(),
  answers: jsonb('answers').$type<CandidateAnswer[]>().notNull().default([]),
  overallScore: numeric('overall_score', {
    precision: 5,
    scale: 2,
    mode: 'number',
  }),
  categoryScores: jsonb('category_scores').$type<CategoryScores>(),
  timeTakenSeconds: integer('time_taken_seconds'),
  isAntiCheatFlagged: boolean('is_anti_cheat_flagged').notNull().default(false),
  antiCheatFlags: text('anti_cheat_flags').array(),
  disqualificationReason: text('disqualification_reason'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  isUnlocked: boolean('is_unlocked').notNull().default(false),
});

export const submissionsRelations = relations(submissions, ({ one }) => ({
  job: one(jobs, {
    fields: [submissions.jobId],
    references: [jobs.id],
  }),
  simulation: one(simulations, {
    fields: [submissions.simulationId],
    references: [simulations.id],
  }),
  candidate: one(jobSeekerProfiles, {
    fields: [submissions.candidateId],
    references: [jobSeekerProfiles.id],
  }),
}));

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
