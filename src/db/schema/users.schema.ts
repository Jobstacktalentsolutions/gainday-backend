import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { jobs } from './jobs.schema';
import { submissions } from './submissions.schema';

export const userRoleEnum = pgEnum('user_role', [
  'EMPLOYER',
  'JOB_SEEKER',
  'ADMIN',
]);
export const authProviderEnum = pgEnum('auth_provider', ['local', 'google']);

export const UserRole = {
  EMPLOYER: 'EMPLOYER',
  JOB_SEEKER: 'JOB_SEEKER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AuthProvider = {
  LOCAL: 'local',
  GOOGLE: 'google',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export interface CapabilityScores {
  [domain: string]: {
    score: number;
    updatedAt: string;
    categories: {
      problemSolving: number;
      judgmentExecution: number;
      writtenCommunication: number;
      commercialDomainAwareness: number;
    };
  };
}

export const users = pgTable('users', {
  ...baseColumns,
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  role: userRoleEnum('role').notNull().$type<UserRole>(),
  authProvider: authProviderEnum('auth_provider')
    .notNull()
    .default('local')
    .$type<AuthProvider>(),
  googleId: varchar('google_id', { length: 255 }).unique(),
  fullName: varchar('full_name', { length: 255 }),
  companyName: varchar('company_name', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 50 }),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  emailVerificationExpires: timestamp('email_verification_expires', {
    withTimezone: true,
  }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires', {
    withTimezone: true,
  }),
  capabilityScores: jsonb('capability_scores').$type<CapabilityScores>(),
  isActive: boolean('is_active').notNull().default(true),
});

export const usersRelations = relations(users, ({ many }) => ({
  jobs: many(jobs),
  submissions: many(submissions),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
