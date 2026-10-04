import {
  boolean,
  index,
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

/** One task's grading result — see src/modules/grading/. Each score in `categoryScores` here is
 *  on the same 0-10 scale as the anchors it was graded against (not the 0-100 scale of the
 *  submission-level `overallScore`, which is a separate weighted rollup — see
 *  grading/roll-up.ts). `summary` is the candidate-facing one-or-two-sentence reason shown/
 *  emailed to them for this specific task. */
export interface TaskGradingResult {
  taskId: string;
  questionBankId: string;
  categoryScores: CategoryScores;
  summary: string;
}

export interface GuestInfo {
  fullName: string;
  email: string;
  phoneNumber?: string;
}

/**
 * One proctoring signal, tied to when and which task it happened during — replaces an earlier
 * design that only stored a flat `"type ×count"` summary string per violation type for the
 * whole run, with no way to say *when* something happened or relative to which task.
 *
 * `type` is an open string, not an enum, deliberately: it's produced by several independent
 * frontend listeners (gainday-frontend/src/features/candidate/hooks/{useTabVisibilityGuard,
 * useFullscreenGuard,useIdleDetection}.ts) plus this backend's own server-observed check (see
 * SubmissionsService.submitAnswers), and a DB enum would need a migration every time a new
 * listener is added — known values today: "tab-hidden", "window-blur", "fullscreen-exit",
 * "idle", "server-stale-heartbeat".
 */
export interface AntiCheatEvent {
  type: string;
  /** Which task was active when this was recorded — null when there isn't a meaningful one
   *  (e.g. the server-observed stale-heartbeat check, which fires once at submit time, after
   *  the run has already ended). */
  taskId: string | null;
  /** ISO 8601 — when the event was *recorded*. For "idle", that's when the spell was closed out
   *  (by activity, or by the end-of-run flush), not when the idle period started. */
  occurredAt: string;
  /** Only present for "idle" — the spell's real measured length, not a fixed-size tick. See
   *  useIdleDetection.ts. */
  durationMs?: number;
}

export const submissions = pgTable(
  'submissions',
  {
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
    // Per-task breakdown behind the rolled-up categoryScores above — see TaskGradingResult.
    taskScores: jsonb('task_scores').$type<TaskGradingResult[]>(),
    timeTakenSeconds: integer('time_taken_seconds'),
    isAntiCheatFlagged: boolean('is_anti_cheat_flagged')
      .notNull()
      .default(false),
    // A per-event log (see AntiCheatEvent), not a flat summary-string array — was
    // text('anti_cheat_flags').array() before, which could only hold "type ×count" totals for the
    // whole run with no per-event timing or task association.
    antiCheatFlags: jsonb('anti_cheat_flags')
      .$type<AntiCheatEvent[]>()
      .notNull()
      .default([]),
    disqualificationReason: text('disqualification_reason'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    isUnlocked: boolean('is_unlocked').notNull().default(false),
    // Last POST /submissions/:id/heartbeat received from the candidate's client during the run —
    // an authenticated liveness ping, not just a raw connectivity check (see
    // SubmissionsService.recordHeartbeat). A stale value at submit time auto-flags the submission.
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  },
  (table) => [
    index('submissions_candidate_job_idx').on(table.candidateId, table.jobId),
  ],
);

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
