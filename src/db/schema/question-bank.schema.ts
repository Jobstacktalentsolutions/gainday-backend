import {
  index,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';
import { jobs } from './jobs.schema';
import { halfvec } from './vector.column';
import { InterfaceType } from '../../modules/generation/roles/interface-type';

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

/** GitHub-flavored Markdown source — plain text is valid markdown, so this covers both without
 *  a separate "plain" mode; use markdown syntax (bold/italic/bullets/paragraphs) only where it
 *  genuinely aids readability, never pre-rendered HTML. The frontend must render this through a
 *  renderer that does not interpret raw HTML in the source (e.g. react-markdown without
 *  rehype-raw), so content can never inject arbitrary markup. */
export type MarkdownString = string;

export interface QuestionBankTaskContent {
  taskType: string;
  title: string;
  /** Markdown — see {@link MarkdownString}. */
  scenarioDescription: MarkdownString;
  /** Markdown — see {@link MarkdownString}. */
  questionPrompt: MarkdownString;
  objectiveComponent?: Record<string, unknown>;
  openEndedComponent?: Record<string, unknown>;
  businessProblemDerived: boolean;
  /** Tells the frontend how to render this task (doc Section 2.5). */
  interfaceType: InterfaceType;
  /** Data conforming to INTERFACE_SCHEMAS[interfaceType] — the concrete render contract for
   *  the frontend (never just a tag string with an unvalidated shape). */
  interfacePayload: Record<string, unknown>;
}

export const questionBank = pgTable(
  'question_bank',
  {
    ...baseColumns,
    category: varchar('category', { length: 255 }).notNull(),
    subCategory: varchar('sub_category', { length: 255 }),
    intent: text('intent').notNull(),
    taskType: varchar('task_type', { length: 100 }).notNull(),
    taskContent: jsonb('task_content')
      .$type<QuestionBankTaskContent>()
      .notNull(),
    // Anchors are a grading-time concern, generated separately from task generation — see
    // src/modules/grading/. Nullable until that pipeline exists and populates this.
    anchors: jsonb('anchors').$type<AnchorResponse[]>(),
    sourceJobId: uuid('source_job_id').references(() => jobs.id, {
      onDelete: 'set null',
    }),
    // halfvec (not vector): HNSW on `vector` caps at 2000 dims, and this is
    // 3072-d (gemini-embedding-001). halfvec raises the HNSW cap to 4000 by
    // storing each dimension as a 16-bit float instead of 32-bit.
    embedding: halfvec('embedding', EMBEDDING_DIMENSIONS).notNull(),
  },
  (table) => [
    index('question_bank_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('halfvec_cosine_ops'),
    ),
    index('question_bank_category_idx').on(table.category),
  ],
);

export type QuestionBankEntry = typeof questionBank.$inferSelect;
export type NewQuestionBankEntry = typeof questionBank.$inferInsert;
