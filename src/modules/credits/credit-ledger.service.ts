import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  creditLedgerEntries,
  creditPurchases,
  employerProfiles,
} from '../../db/schema';
import type { DbExecutor } from './db-executor.type';
import { InsufficientCreditsError } from './insufficient-credits.error';

@Injectable()
export class CreditLedgerService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async getBalance(
    employerId: string,
    executor: DbExecutor = this.db,
  ): Promise<number> {
    const [row] = await executor
      .select({
        balance: sql<number>`coalesce(sum(${creditLedgerEntries.amount}), 0)::int`,
      })
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.employerId, employerId));
    return row.balance;
  }

  async findUnlockedSubmissionIds(
    employerId: string,
    submissionIds: string[],
    executor: DbExecutor = this.db,
  ): Promise<Set<string>> {
    if (submissionIds.length === 0) {
      return new Set();
    }
    const rows = await executor
      .select({ submissionId: creditLedgerEntries.submissionId })
      .from(creditLedgerEntries)
      .where(
        and(
          eq(creditLedgerEntries.employerId, employerId),
          eq(creditLedgerEntries.type, 'UNLOCK'),
          isNotNull(creditLedgerEntries.submissionId),
          inArray(creditLedgerEntries.submissionId, submissionIds),
        ),
      );
    return new Set(rows.flatMap((row) => row.submissionId ?? []));
  }

  /**
   * Spends one credit per submission not already unlocked by this employer and returns the ids
   * that were newly unlocked (already-unlocked ones are free and omitted). All-or-nothing: if the
   * balance can't cover every new unlock, nothing is spent and InsufficientCreditsError is thrown.
   *
   * The employer's profile row is locked for the duration so two concurrent unlocks can't both
   * read the same balance and overspend it.
   */
  async unlockSubmissions(
    employerId: string,
    submissionIds: string[],
  ): Promise<string[]> {
    const requestedIds = [...new Set(submissionIds)];

    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: employerProfiles.id })
        .from(employerProfiles)
        .where(eq(employerProfiles.id, employerId))
        .for('update');

      const alreadyUnlocked = await this.findUnlockedSubmissionIds(
        employerId,
        requestedIds,
        tx,
      );
      const newlyUnlockedIds = requestedIds.filter(
        (id) => !alreadyUnlocked.has(id),
      );
      if (newlyUnlockedIds.length === 0) {
        return [];
      }

      const balance = await this.getBalance(employerId, tx);
      if (balance < newlyUnlockedIds.length) {
        throw new InsufficientCreditsError(balance, newlyUnlockedIds.length);
      }

      await tx.insert(creditLedgerEntries).values(
        newlyUnlockedIds.map((submissionId) => ({
          employerId,
          type: 'UNLOCK' as const,
          amount: -1,
          submissionId,
        })),
      );
      return newlyUnlockedIds;
    });
  }

  /**
   * Marks the purchase paid and credits it to the employer's ledger. Safe to call repeatedly
   * (Stripe retries webhooks): the unique creditPurchaseId on the ledger means a purchase is
   * credited at most once.
   */
  async grantPurchase(stripePaymentIntentId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [purchase] = await tx
        .update(creditPurchases)
        .set({ status: 'SUCCEEDED', updatedAt: new Date() })
        .where(eq(creditPurchases.stripePaymentIntentId, stripePaymentIntentId))
        .returning();
      if (!purchase) {
        throw new Error(
          `No credit purchase found for payment intent ${stripePaymentIntentId}`,
        );
      }

      await tx
        .insert(creditLedgerEntries)
        .values({
          employerId: purchase.employerId,
          type: 'PURCHASE',
          amount: purchase.credits,
          creditPurchaseId: purchase.id,
        })
        .onConflictDoNothing({ target: creditLedgerEntries.creditPurchaseId });
    });
  }
}
