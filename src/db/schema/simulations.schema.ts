import { integer, jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { jobs } from './jobs.schema';
import { submissions } from './submissions.schema';
import { AnchorResponse } from './question-bank.schema';

export type ObjectiveComponentType =
  | 'NUMERIC_INPUT'
  | 'CLASSIFICATION'
  | 'PROCEDURAL_SEQUENCING'
  | 'SINGLE_BEST_ACTION'
  | 'MULTI_SELECT_UNDER_CONSTRAINT';

export type OpenEndedComponentType =
  | 'WRITTEN_JUSTIFICATION'
  | 'DRAFTED_COMMUNICATION'
  | 'INTERPRETATION_ANALYSIS'
  | 'STAKEHOLDER_PUSHBACK_RESPONSE';

export interface SimulationTask {
  id: string;
  taskType: string; // role-module-defined key (see src/modules/generation/roles)
  category: string;
  title: string;
  scenarioDescription: string;
  questionPrompt: string;
  objectiveComponent?: Record<string, unknown>;
  openEndedComponent?: Record<string, unknown>;
  businessProblemDerived: boolean;
  anchors: AnchorResponse[];
}

export const simulations = pgTable('simulations', {
  ...baseColumns,
  jobId: uuid('job_id')
    .notNull()
    .unique()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  tasks: jsonb('tasks').$type<SimulationTask[]>().notNull(),
  timeLimitMinutes: integer('time_limit_minutes').notNull().default(30),
});

export const simulationsRelations = relations(simulations, ({ one, many }) => ({
  job: one(jobs, {
    fields: [simulations.jobId],
    references: [jobs.id],
  }),
  submissions: many(submissions),
}));

export type Simulation = typeof simulations.$inferSelect;
export type NewSimulation = typeof simulations.$inferInsert;
