import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  creditLedgerEntries,
  creditPurchases,
  employerProfiles,
  submissions,
} from '../../db/schema';
import type { DbExecutor } from './db-executor.type';
import { InsufficientCreditsError } from './insufficient-credits.error';
import { SubmissionWithdrawnError } from './submission-withdrawn.error';
import { SignupBonusSettingsService } from './signup-bonus-settings.service';

// Postgres' unique_violation code — used to detect a repeated/concurrent signup bonus grant
// without needing a transaction wrapping the whole signup flow (see grantSignupBonus).
const POSTGRES_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

@Injectable()
export class CreditLedgerService {
  private readonly logger = new Logger(CreditLedgerService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly signupBonusSettings: SignupBonusSettingsService,
  ) {}

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

  /** When the employer's credits were last topped up by an actual purchase — null if they've
   *  never bought a pack (a signup bonus alone doesn't count as a "recharge"). */
  async getLastPurchaseAt(employerId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ createdAt: creditLedgerEntries.createdAt })
      .from(creditLedgerEntries)
      .where(
        and(
          eq(creditLedgerEntries.employerId, employerId),
          eq(creditLedgerEntries.type, 'PURCHASE'),
        ),
      )
      .orderBy(desc(creditLedgerEntries.createdAt))
      .limit(1);
    return row?.createdAt ?? null;
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

      // Checked inside the transaction, before any credit is spent, so a candidate withdrawing
      // at the same moment as the employer unlocking them can't slip through a stale read.
      const withdrawn = await tx
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            inArray(submissions.id, newlyUnlockedIds),
            eq(submissions.status, 'WITHDRAWN'),
          ),
        );
      if (withdrawn.length > 0) {
        throw new SubmissionWithdrawnError();
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
   * Grants the configured signup bonus to a newly created employer, if an admin has it enabled
   * with a non-zero amount. A no-op (not an error) when it's disabled, so it's safe to call on
   * every signup unconditionally.
   *
   * Deliberately run *after* the signup transaction commits, not nested inside it: granting the
   * bonus is best-effort (logged, not fatal, on failure) and must never be able to roll back
   * account creation. The unique partial index on (employerId) WHERE type = 'SIGNUP_BONUS' is
   * the actual idempotency guarantee — a repeated or racing call simply hits that constraint and
   * is treated as "already granted", not retried or escalated.
   */
  async grantSignupBonus(employerId: string): Promise<void> {
    const settings = await this.signupBonusSettings.get();
    if (!settings.enabled || settings.creditAmount <= 0) {
      return;
    }

    try {
      await this.db.insert(creditLedgerEntries).values({
        employerId,
        type: 'SIGNUP_BONUS',
        amount: settings.creditAmount,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.debug(
          `Signup bonus already granted for employer ${employerId}`,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Marks the purchase paid and credits it to the employer's ledger. Safe to call repeatedly
   * (Stripe retries webhooks): the unique creditPurchaseId on the ledger means a purchase is
   * credited at most once.
   */
  async grantPurchase(stripeCheckoutSessionId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [purchase] = await tx
        .update(creditPurchases)
        .set({ status: 'SUCCEEDED', updatedAt: new Date() })
        .where(
          eq(creditPurchases.stripeCheckoutSessionId, stripeCheckoutSessionId),
        )
        .returning();
      if (!purchase) {
        throw new Error(
          `No credit purchase found for checkout session ${stripeCheckoutSessionId}`,
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
