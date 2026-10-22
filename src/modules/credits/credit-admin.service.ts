import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  CreditLedgerEntryType,
  creditLedgerEntries,
  creditPurchases,
  employerProfiles,
} from '../../db/schema';
import {
  buildTimeBuckets,
  type AnalyticsTimeframe,
} from '../admin/analytics-buckets';
import { SignupBonusSettingsService } from './signup-bonus-settings.service';

export interface ListCreditLedgerParams {
  page: number;
  limit: number;
  type?: CreditLedgerEntryType;
}

interface TypeSummary {
  entries: number;
  credits: number;
}

@Injectable()
export class CreditAdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly signupBonusSettings: SignupBonusSettingsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Admin dashboard figures, all derived from the ledger so they always reconcile with it.
   * Every entry type is present in `summary` (zeroed when there are no rows yet).
   */
  async getOverview() {
    const [signupBonus, rows, allTimeGbpPence] = await Promise.all([
      this.signupBonusSettings.get(),
      this.db
        .select({
          type: creditLedgerEntries.type,
          entries: sql<number>`count(*)::int`,
          credits: sql<number>`coalesce(sum(${creditLedgerEntries.amount}), 0)::int`,
        })
        .from(creditLedgerEntries)
        .groupBy(creditLedgerEntries.type),
      this.getAllTimeRevenuePence(),
    ]);

    const summary = Object.fromEntries(
      Object.values(CreditLedgerEntryType).map((type) => [
        type,
        { entries: 0, credits: 0 } satisfies TypeSummary,
      ]),
    ) as Record<CreditLedgerEntryType, TypeSummary>;
    for (const row of rows) {
      summary[row.type] = { entries: row.entries, credits: row.credits };
    }

    return {
      signupBonus,
      totals: {
        signupBonusRecipients: summary.SIGNUP_BONUS.entries,
        signupBonusCredits: summary.SIGNUP_BONUS.credits,
        purchasedCredits: summary.PURCHASE.credits,
        // UNLOCK rows are stored as negative amounts; report the spend as a positive number.
        creditsSpent: Math.abs(summary.UNLOCK.credits),
        outstandingCredits: Object.values(summary).reduce(
          (total, entry) => total + entry.credits,
          0,
        ),
      },
      revenue: {
        currency: 'GBP' as const,
        usdRate: this.gbpUsdRate(),
        allTimeGbpPence,
        allTimeUsd: this.toUsd(allTimeGbpPence),
      },
    };
  }

  /**
   * Revenue from succeeded credit purchases, bucketed the same way as the dashboard activity
   * chart. A purchase counts in the period its ledger entry was written, which is when payment
   * succeeded. For `year` and `all` the window is the last 12 months.
   */
  async getRevenue(timeframe: AnalyticsTimeframe) {
    const buckets = buildTimeBuckets(timeframe).map((bucket) => ({
      ...bucket,
      pence: 0,
      purchases: 0,
    }));
    const windowStart = new Date(
      Math.min(...buckets.map((bucket) => bucket.startTime)),
    );

    const paid = await this.db
      .select({
        pricePence: creditPurchases.pricePence,
        paidAt: creditLedgerEntries.createdAt,
      })
      .from(creditLedgerEntries)
      .innerJoin(
        creditPurchases,
        eq(creditLedgerEntries.creditPurchaseId, creditPurchases.id),
      )
      .where(
        and(
          eq(creditLedgerEntries.type, 'PURCHASE'),
          gte(creditLedgerEntries.createdAt, windowStart),
        ),
      );

    for (const purchase of paid) {
      const time = purchase.paidAt.getTime();
      const bucket = buckets.find(
        (candidate) => time >= candidate.startTime && time < candidate.endTime,
      );
      if (bucket) {
        bucket.pence += purchase.pricePence;
        bucket.purchases += 1;
      }
    }

    const periodPence = buckets.reduce((total, bucket) => total + bucket.pence, 0);
    const periodPurchases = buckets.reduce(
      (total, bucket) => total + bucket.purchases,
      0,
    );
    const allTimePence = await this.getAllTimeRevenuePence();

    return {
      timeframe,
      currency: 'GBP' as const,
      usdRate: this.gbpUsdRate(),
      totals: {
        periodPence,
        periodUsd: this.toUsd(periodPence),
        periodPurchases,
        allTimePence,
        allTimeUsd: this.toUsd(allTimePence),
      },
      series: buckets.map((bucket) => ({
        label: bucket.label,
        pence: bucket.pence,
        usd: this.toUsd(bucket.pence),
        purchases: bucket.purchases,
      })),
    };
  }

  async listLedger({ page, limit, type }: ListCreditLedgerParams) {
    const where = type ? eq(creditLedgerEntries.type, type) : undefined;

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(creditLedgerEntries)
      .where(where);

    const rows = await this.db
      .select({
        id: creditLedgerEntries.id,
        type: creditLedgerEntries.type,
        amount: creditLedgerEntries.amount,
        employerId: creditLedgerEntries.employerId,
        employerName: employerProfiles.companyName,
        submissionId: creditLedgerEntries.submissionId,
        createdAt: creditLedgerEntries.createdAt,
      })
      .from(creditLedgerEntries)
      .innerJoin(
        employerProfiles,
        eq(creditLedgerEntries.employerId, employerProfiles.id),
      )
      .where(where)
      .orderBy(desc(creditLedgerEntries.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const totalPages = Math.ceil(total / limit);
    return {
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  private async getAllTimeRevenuePence(): Promise<number> {
    const [row] = await this.db
      .select({
        pence: sql<number>`coalesce(sum(${creditPurchases.pricePence}), 0)::int`,
      })
      .from(creditLedgerEntries)
      .innerJoin(
        creditPurchases,
        eq(creditLedgerEntries.creditPurchaseId, creditPurchases.id),
      )
      .where(eq(creditLedgerEntries.type, 'PURCHASE'));
    return row.pence;
  }

  /** USD per 1 GBP, or null when GBP_USD_RATE isn't configured. */
  private gbpUsdRate(): number | null {
    return this.config.get<number | null>('credits.gbpUsdRate', null);
  }

  /** Converts pence to dollars rounded to the cent, or null when no rate is configured. */
  private toUsd(pence: number): number | null {
    const rate = this.gbpUsdRate();
    if (rate === null) {
      return null;
    }
    return Math.round(pence * rate) / 100;
  }
}
