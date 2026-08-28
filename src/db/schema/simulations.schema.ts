import { integer, jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { jobs } from './jobs.schema';
import { submissions } from './submissions.schema';

export interface SimulationTaskOption {
  id: string;
  title: string;
  description: string;
}

export interface SimulationTask {
  id: string;
  type: 'TRIAGE_PRIORITIZATION' | 'INTERPRET_SUMMARIZE' | 'TRADE_OFF_DECISION' | 'STAKEHOLDER_RESPONSE';
  title: string;
  scenarioDescription: string;
  questionPrompt: string;
  wordLimit?: number;
  optionsToPrioritize?: SimulationTaskOption[];
  businessProblemDerived: boolean;
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
