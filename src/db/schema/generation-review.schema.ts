import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { jobs } from './jobs.schema';
import { users } from './users.schema';
import {
  AnchorResponse,
  QuestionBankTaskContent,
} from './question-bank.schema';

export const generationReviewStatusEnum = pgEnum('generation_review_status', [
  'PENDING',
  'APPROVED_WITH_EDITS',
  'REJECTED',
]);

export const GenerationReviewStatus = {
  PENDING: 'PENDING',
  APPROVED_WITH_EDITS: 'APPROVED_WITH_EDITS',
  REJECTED: 'REJECTED',
} as const;
export type GenerationReviewStatus =
  (typeof GenerationReviewStatus)[keyof typeof GenerationReviewStatus];

export interface FailedGenerationAttempt {
  attemptNumber: number;
  candidateId: string;
  taskDraft: QuestionBankTaskContent;
  anchors: AnchorResponse[];
  criticFailureReasons: string[];
}

export const generationReviewItems = pgTable('generation_review_items', {
  ...baseColumns,
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  slotIndex: integer('slot_index').notNull(),
  category: varchar('category', { length: 255 }).notNull(),
  attempts: jsonb('attempts').$type<FailedGenerationAttempt[]>().notNull(),
  status: generationReviewStatusEnum('status')
    .notNull()
    .default('PENDING')
    .$type<GenerationReviewStatus>(),
  resolvedTaskContent: jsonb(
    'resolved_task_content',
  ).$type<QuestionBankTaskContent | null>(),
  resolvedAnchors: jsonb('resolved_anchors').$type<AnchorResponse[] | null>(),
  reviewedByAdminId: uuid('reviewed_by_admin_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});

export const generationReviewItemsRelations = relations(
  generationReviewItems,
  ({ one }) => ({
    job: one(jobs, {
      fields: [generationReviewItems.jobId],
      references: [jobs.id],
    }),
    reviewedByAdmin: one(users, {
      fields: [generationReviewItems.reviewedByAdminId],
      references: [users.id],
    }),
  }),
);

export type GenerationReviewItem = typeof generationReviewItems.$inferSelect;
export type NewGenerationReviewItem = typeof generationReviewItems.$inferInsert;
