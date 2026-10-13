import { integer, pgEnum, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { baseColumns } from './columns.helpers';
import { employerProfiles } from './employer-profiles.schema';

export const creditPurchaseStatusEnum = pgEnum('credit_purchase_status', [
  'PENDING',
  'SUCCEEDED',
  'FAILED',
]);

export const CreditPurchaseStatus = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;
export type CreditPurchaseStatus =
  (typeof CreditPurchaseStatus)[keyof typeof CreditPurchaseStatus];

/**
 * One row per credit pack an employer tried to buy — "pack name, credits added, price, and
 * whether it was charged". `packId`, `credits` and `pricePence` are a snapshot of the pack
 * catalogue (modules/credits/credit-packs.ts) at purchase time, so later price changes never
 * rewrite history. Credits only reach the employer's balance through a PURCHASE row in
 * credit_ledger_entries, which is written when status becomes SUCCEEDED.
 */
export const creditPurchases = pgTable('credit_purchases', {
  ...baseColumns,
  employerId: uuid('employer_id')
    .notNull()
    .references(() => employerProfiles.id, { onDelete: 'restrict' }),
  packId: varchar('pack_id', { length: 50 }).notNull(),
  credits: integer('credits').notNull(),
  pricePence: integer('price_pence').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 })
    .notNull()
    .unique(),
  status: creditPurchaseStatusEnum('status')
    .notNull()
    .default('PENDING')
    .$type<CreditPurchaseStatus>(),
});

export type CreditPurchase = typeof creditPurchases.$inferSelect;
export type NewCreditPurchase = typeof creditPurchases.$inferInsert;
