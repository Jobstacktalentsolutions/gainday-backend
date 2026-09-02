import {
  boolean,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseColumns } from './columns.helpers';
import { employerProfiles } from './employer-profiles.schema';
import { jobSeekerProfiles } from './job-seeker-profiles.schema';
import { adminProfiles } from './admin-profiles.schema';

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
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  emailVerificationExpires: timestamp('email_verification_expires', {
    withTimezone: true,
  }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires', {
    withTimezone: true,
  }),
  isActive: boolean('is_active').notNull().default(true),
});

export const usersRelations = relations(users, ({ one }) => ({
  employerProfile: one(employerProfiles, {
    fields: [users.id],
    references: [employerProfiles.userId],
  }),
  jobSeekerProfile: one(jobSeekerProfiles, {
    fields: [users.id],
    references: [jobSeekerProfiles.userId],
  }),
  adminProfile: one(adminProfiles, {
    fields: [users.id],
    references: [adminProfiles.userId],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
