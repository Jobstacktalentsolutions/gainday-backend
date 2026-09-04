import {
  boolean,
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
import { simulations } from './simulations.schema';
import { submissions } from './submissions.schema';
import { employerProfiles } from './employer-profiles.schema';

export const jobStatusEnum = pgEnum('job_status', [
  'DRAFT',
  'GENERATING',
  'ACTIVE',
  'INACTIVE',
  'SHORTLIST_READY',
  'GENERATION_FAILED',
  'TERMINATED',
]);

export const JobStatus = {
  DRAFT: 'DRAFT',
  GENERATING: 'GENERATING',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SHORTLIST_READY: 'SHORTLIST_READY',
  GENERATION_FAILED: 'GENERATION_FAILED',
  TERMINATED: 'TERMINATED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const jobRoleEnum = pgEnum('job_role', ['FINANCE', 'SALES']);

export const JobRole = {
  FINANCE: 'FINANCE',
  SALES: 'SALES',
} as const;
export type JobRole = (typeof JobRole)[keyof typeof JobRole];

export interface SalaryRange {
  min: number | null;
  max: number | null;
  currency: string;
}

export const jobs = pgTable('jobs', {
  ...baseColumns,
  title: varchar('title', { length: 255 }),
  description: text('description'),
  requiredSkills: text('required_skills').array().notNull().default([]),
  role: jobRoleEnum('role').$type<JobRole>(),
  skillLevel: varchar('skill_level', { length: 100 }),
  skillCategory: varchar('skill_category', { length: 255 }),
  companyDescription: text('company_description'),
  isRemoteFriendly: boolean('is_remote_friendly').notNull().default(false),
  location: varchar('location', { length: 255 }),
  employmentType: varchar('employment_type', { length: 100 }),
  salaryRange: jsonb('salary_range').$type<SalaryRange>(),
  applicationDeadline: timestamp('application_deadline', {
    withTimezone: true,
  }),
  businessProblem: text('business_problem'),
  status: jobStatusEnum('status').notNull().default('DRAFT').$type<JobStatus>(),
  employerId: uuid('employer_id')
    .notNull()
    .references(() => employerProfiles.id, { onDelete: 'cascade' }),
});

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  employer: one(employerProfiles, {
    fields: [jobs.employerId],
    references: [employerProfiles.id],
  }),
  simulation: one(simulations, {
    fields: [jobs.id],
    references: [simulations.jobId],
  }),
  submissions: many(submissions),
}));

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
