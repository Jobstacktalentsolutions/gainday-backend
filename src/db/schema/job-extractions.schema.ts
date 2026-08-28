import { jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { jobs } from './jobs.schema';

export interface TaskCandidateJudgeScore {
  alignmentWithIntent: number;
  alignmentWithCategory: number;
  problemIncorporationPotential: number | null;
  composite: number;
}

export interface TaskCandidateRecord {
  candidateId: string;
  taskType: string;
  briefDescription: string;
  judgeScore?: TaskCandidateJudgeScore;
  selected: boolean;
}

export const jobExtractions = pgTable('job_extractions', {
  ...baseColumns,
  jobId: uuid('job_id')
    .notNull()
    .unique()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 255 }).notNull(),
  intent: text('intent').notNull(),
  problem: text('problem'),
  candidatePool: jsonb('candidate_pool').$type<TaskCandidateRecord[]>().notNull(),
});

export const jobExtractionsRelations = relations(jobExtractions, ({ one }) => ({
  job: one(jobs, {
    fields: [jobExtractions.jobId],
    references: [jobs.id],
  }),
}));

export type JobExtraction = typeof jobExtractions.$inferSelect;
export type NewJobExtraction = typeof jobExtractions.$inferInsert;
