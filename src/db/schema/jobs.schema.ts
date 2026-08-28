import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { users } from './users.schema';
import { simulations } from './simulations.schema';
import { submissions } from './submissions.schema';

export const jobStatusEnum = pgEnum('job_status', [
  'DRAFT',
  'GENERATING',
  'ACTIVE',
  'UNDER_REVIEW',
  'SHORTLIST_READY',
  'CLOSED',
  'GENERATION_FAILED',
]);

export const JobStatus = {
  DRAFT: 'DRAFT',
  GENERATING: 'GENERATING',
  ACTIVE: 'ACTIVE',
  UNDER_REVIEW: 'UNDER_REVIEW',
  SHORTLIST_READY: 'SHORTLIST_READY',
  CLOSED: 'CLOSED',
  GENERATION_FAILED: 'GENERATION_FAILED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export interface SalaryRange {
  min: number;
  max: number;
  currency: string;
}

export const jobs = pgTable('jobs', {
  ...baseColumns,
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  requiredSkills: text('required_skills').array().notNull(),
  roleCategory: varchar('role_category', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  employmentType: varchar('employment_type', { length: 100 }).notNull(),
  salaryRange: jsonb('salary_range').$type<SalaryRange>().notNull(),
  applicationDeadline: timestamp('application_deadline', {
    withTimezone: true,
  }).notNull(),
  businessProblem: text('business_problem').notNull(),
  status: jobStatusEnum('status').notNull().default('DRAFT').$type<JobStatus>(),
  employerId: uuid('employer_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  employer: one(users, {
    fields: [jobs.employerId],
    references: [users.id],
  }),
  simulation: one(simulations, {
    fields: [jobs.id],
    references: [simulations.jobId],
  }),
  submissions: many(submissions),
}));

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
