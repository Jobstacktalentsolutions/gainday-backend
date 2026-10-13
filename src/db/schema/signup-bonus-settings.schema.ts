import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { adminProfiles } from './admin-profiles.schema';

// A fixed-id singleton row rather than a generic key/value settings table: there's exactly one
// thing to configure today (the signup bonus), and the CHECK below makes a second row impossible
// rather than just unlikely. If more admin-configurable toggles show up later, revisit then
// rather than guessing their shape now.
export const SIGNUP_BONUS_SETTINGS_ID = 'global';

export const signupBonusSettings = pgTable(
  'signup_bonus_settings',
  {
    id: varchar('id', { length: 20 })
      .primaryKey()
      .default(SIGNUP_BONUS_SETTINGS_ID),
    enabled: boolean('enabled').notNull().default(false),
    creditAmount: integer('credit_amount').notNull().default(0),
    // Who last changed it — audit trail only, not used to decide anything.
    updatedByAdminId: uuid('updated_by_admin_id').references(
      () => adminProfiles.id,
      { onDelete: 'set null' },
    ),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // sql.raw, not a `${}` interpolation: a CHECK constraint is DDL, not a parameterized query —
    // interpolating the constant produces an unbound "$1" placeholder that fails at migrate time.
    check(
      'signup_bonus_settings_singleton',
      sql`${table.id} = ${sql.raw(`'${SIGNUP_BONUS_SETTINGS_ID}'`)}`,
    ),
    check(
      'signup_bonus_settings_credit_amount_non_negative',
      sql`${table.creditAmount} >= 0`,
    ),
  ],
);

export type SignupBonusSettings = typeof signupBonusSettings.$inferSelect;
export type NewSignupBonusSettings = typeof signupBonusSettings.$inferInsert;
