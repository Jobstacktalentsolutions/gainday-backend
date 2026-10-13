import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';
import { employerProfiles } from './employer-profiles.schema';
import { creditPurchases } from './credit-purchases.schema';
import { submissions } from './submissions.schema';

export const creditLedgerEntryTypeEnum = pgEnum('credit_ledger_entry_type', [
  'PURCHASE',
  'UNLOCK',
  'SIGNUP_BONUS',
]);

export const CreditLedgerEntryType = {
  PURCHASE: 'PURCHASE',
  UNLOCK: 'UNLOCK',
  SIGNUP_BONUS: 'SIGNUP_BONUS',
} as const;
export type CreditLedgerEntryType =
  (typeof CreditLedgerEntryType)[keyof typeof CreditLedgerEntryType];

/**
 * Append-only credit ledger. An employer's balance is always SUM(amount) over their rows — it is
 * never stored — so every credit and debit can be audited.
 *
 *  - PURCHASE:      amount > 0, linked to the credit_purchases row that paid for it.
 *  - UNLOCK:        amount < 0 (one credit), linked to the unlocked submission. A submission is
 *                   unlocked for an employer exactly when an UNLOCK row exists for it.
 *  - SIGNUP_BONUS:  amount > 0, free credits granted once per employer on signup, controlled by
 *                   signup_bonus_settings (see SignupBonusSettingsService). Not linked to a
 *                   purchase or submission.
 *
 * Rows are never updated or deleted. `submissionId` is set null (rather than cascading) when a
 * submission is deleted, so the debit survives in the audit trail.
 */
export const creditLedgerEntries = pgTable(
  'credit_ledger_entries',
  {
    ...baseColumns,
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employerProfiles.id, { onDelete: 'restrict' }),
    type: creditLedgerEntryTypeEnum('type')
      .notNull()
      .$type<CreditLedgerEntryType>(),
    amount: integer('amount').notNull(),
    // Unique: a purchase can only ever be credited once, which makes the webhook idempotent.
    creditPurchaseId: uuid('credit_purchase_id')
      .unique()
      .references(() => creditPurchases.id, { onDelete: 'restrict' }),
    submissionId: uuid('submission_id').references(() => submissions.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('credit_ledger_entries_employer_idx').on(table.employerId),
    // Unlocking the same candidate twice never costs a second credit.
    uniqueIndex('credit_ledger_entries_unlock_unique')
      .on(table.employerId, table.submissionId)
      .where(sql`${table.type} = 'UNLOCK'`),
    // An employer is ever granted the signup bonus once, no matter how many times it's
    // (re)triggered — see CreditLedgerService.grantSignupBonus.
    uniqueIndex('credit_ledger_entries_signup_bonus_unique')
      .on(table.employerId)
      .where(sql`${table.type} = 'SIGNUP_BONUS'`),
    check(
      'credit_ledger_entries_amount_sign',
      sql`(${table.type} = 'PURCHASE' AND ${table.amount} > 0 AND ${table.creditPurchaseId} IS NOT NULL) OR (${table.type} = 'UNLOCK' AND ${table.amount} < 0) OR (${table.type} = 'SIGNUP_BONUS' AND ${table.amount} > 0 AND ${table.creditPurchaseId} IS NULL)`,
    ),
  ],
);

export const creditLedgerEntriesRelations = relations(
  creditLedgerEntries,
  ({ one }) => ({
    employer: one(employerProfiles, {
      fields: [creditLedgerEntries.employerId],
      references: [employerProfiles.id],
    }),
    purchase: one(creditPurchases, {
      fields: [creditLedgerEntries.creditPurchaseId],
      references: [creditPurchases.id],
    }),
    submission: one(submissions, {
      fields: [creditLedgerEntries.submissionId],
      references: [submissions.id],
    }),
  }),
);

export type CreditLedgerEntry = typeof creditLedgerEntries.$inferSelect;
export type NewCreditLedgerEntry = typeof creditLedgerEntries.$inferInsert;
