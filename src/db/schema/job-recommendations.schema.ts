import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';
import { halfvec } from './vector.column';
import { jobs } from './jobs.schema';
import { jobSeekerProfiles } from './job-seeker-profiles.schema';

// Match vectors are kept apart from question_bank embeddings: they describe candidates and job
// postings, not tasks, and are rebuilt independently. Same model and width as the question bank
// (gemini-embedding-001), so both can be compared against the same embedding space if needed.
const MATCH_EMBEDDING_DIMENSIONS = 3072; // must match ai.gemini.embeddingDimensions

/** A candidate's title and brief, embedded for job matching. `contentHash` lets a run skip
 *  re-embedding a candidate whose title or brief has not changed. */
export const candidateMatchEmbeddings = pgTable('candidate_match_embeddings', {
  ...baseColumns,
  candidateId: uuid('candidate_id')
    .notNull()
    .unique()
    .references(() => jobSeekerProfiles.id, { onDelete: 'cascade' }),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  embedding: halfvec('embedding', MATCH_EMBEDDING_DIMENSIONS).notNull(),
});

/** A job posting, embedded for job matching. See candidateMatchEmbeddings for `contentHash`. */
export const jobMatchEmbeddings = pgTable('job_match_embeddings', {
  ...baseColumns,
  jobId: uuid('job_id')
    .notNull()
    .unique()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  embedding: halfvec('embedding', MATCH_EMBEDDING_DIMENSIONS).notNull(),
});

export const JobRecommendationRunStatus = {
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;
export type JobRecommendationRunStatus =
  (typeof JobRecommendationRunStatus)[keyof typeof JobRecommendationRunStatus];

export const jobRecommendationRunStatusEnum = pgEnum(
  'job_recommendation_run_status',
  [
    JobRecommendationRunStatus.RUNNING,
    JobRecommendationRunStatus.SUCCEEDED,
    JobRecommendationRunStatus.FAILED,
  ],
);

/**
 * One recommendation pass. A pass covers the jobs activated after the previous SUCCEEDED pass's
 * `startedAt` and up to this pass's `startedAt`, so a failed pass is picked up by the next one
 * instead of its jobs being skipped.
 */
export const jobRecommendationRuns = pgTable(
  'job_recommendation_runs',
  {
    ...baseColumns,
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: jobRecommendationRunStatusEnum('status')
      .notNull()
      .$type<JobRecommendationRunStatus>(),
    jobsConsidered: integer('jobs_considered').notNull().default(0),
    recommendationsCreated: integer('recommendations_created')
      .notNull()
      .default(0),
    error: text('error'),
  },
  (table) => [
    index('job_recommendation_runs_status_started_idx').on(
      table.status,
      table.startedAt,
    ),
  ],
);

/** A job recommended to a candidate. The unique pair stops a job being recommended twice, and
 *  the row doubles as the record that the candidate was already notified about it. */
export const jobRecommendations = pgTable(
  'job_recommendations',
  {
    ...baseColumns,
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => jobSeekerProfiles.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .notNull()
      .references(() => jobRecommendationRuns.id, { onDelete: 'cascade' }),
    /** Cosine similarity between the candidate's and the job's embeddings, 0-1. */
    score: real('score').notNull(),
  },
  (table) => [
    unique('job_recommendations_candidate_job_unique').on(
      table.candidateId,
      table.jobId,
    ),
  ],
);

export type CandidateMatchEmbedding =
  typeof candidateMatchEmbeddings.$inferSelect;
export type JobMatchEmbedding = typeof jobMatchEmbeddings.$inferSelect;
export type JobRecommendationRun = typeof jobRecommendationRuns.$inferSelect;
export type JobRecommendation = typeof jobRecommendations.$inferSelect;
