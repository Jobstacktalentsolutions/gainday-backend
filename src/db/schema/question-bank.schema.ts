import { jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';
import { jobs } from './jobs.schema';
import { vector } from './vector.column';

const EMBEDDING_DIMENSIONS = 3072; // must match ai.gemini.embeddingDimensions (gemini-embedding-001)

export interface AnchorResponse {
  score: number; // e.g. 0, 3, 5, 7, 10
  responseText: string;
  criteria: {
    problemSolving: string;
    judgmentExecution: string;
    writtenCommunication: string;
    commercialDomainAwareness: string;
  };
}

export interface QuestionBankTaskContent {
  taskType: string;
  title: string;
  scenarioDescription: string;
  questionPrompt: string;
  objectiveComponent?: Record<string, unknown>;
  openEndedComponent?: Record<string, unknown>;
  businessProblemDerived: boolean;
}

export const questionBank = pgTable('question_bank', {
  ...baseColumns,
  category: varchar('category', { length: 255 }).notNull(),
  subCategory: varchar('sub_category', { length: 255 }),
  intent: text('intent').notNull(),
  taskType: varchar('task_type', { length: 100 }).notNull(),
  taskContent: jsonb('task_content').$type<QuestionBankTaskContent>().notNull(),
  anchors: jsonb('anchors').$type<AnchorResponse[]>().notNull(),
  sourceJobId: uuid('source_job_id').references(() => jobs.id, { onDelete: 'set null' }),
  embedding: vector('embedding', EMBEDDING_DIMENSIONS).notNull(),
});

export type QuestionBankEntry = typeof questionBank.$inferSelect;
export type NewQuestionBankEntry = typeof questionBank.$inferInsert;
