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

interface PurchaseTotals {
  pence: number;
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
    const [signupBonus, rows, { pence: allTimeGbpPence }] = await Promise.all([
      this.signupBonusSettings.get(),
      this.db
        .select({
          type: creditLedgerEntries.type,
          entries: sql<number>`count(*)::int`,
          credits: sql<number>`coalesce(sum(${creditLedgerEntries.amount}), 0)::int`,
        })
        .from(creditLedgerEntries)
        .groupBy(creditLedgerEntries.type),
      this.getPurchaseTotals(),
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
    const { pence: allTimePence } = await this.getPurchaseTotals();

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

  /**
   * Ledger rows with their fiat value. A PURCHASE is worth what was paid. Other rows are valued
   * at the average price per credit across all purchases (`fiatIsEstimate: true`), and have no
   * value (`fiatPence: null`) until at least one purchase exists.
   */
  async listLedger({ page, limit, type }: ListCreditLedgerParams) {
    const where = type ? eq(creditLedgerEntries.type, type) : undefined;

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(creditLedgerEntries)
      .where(where);

    const [rows, purchaseTotals] = await Promise.all([
      this.db
        .select({
          id: creditLedgerEntries.id,
          type: creditLedgerEntries.type,
          amount: creditLedgerEntries.amount,
          employerId: creditLedgerEntries.employerId,
          employerName: employerProfiles.companyName,
          submissionId: creditLedgerEntries.submissionId,
          createdAt: creditLedgerEntries.createdAt,
          purchasePricePence: creditPurchases.pricePence,
        })
        .from(creditLedgerEntries)
        .innerJoin(
          employerProfiles,
          eq(creditLedgerEntries.employerId, employerProfiles.id),
        )
        .leftJoin(
          creditPurchases,
          eq(creditLedgerEntries.creditPurchaseId, creditPurchases.id),
        )
        .where(where)
        .orderBy(desc(creditLedgerEntries.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.getPurchaseTotals(),
    ]);

    const pricePerCredit =
      purchaseTotals.credits === 0
        ? null
        : purchaseTotals.pence / purchaseTotals.credits;

    const items = rows.map((row) => {
      const isPurchase = row.type === CreditLedgerEntryType.PURCHASE;
      const fiatPence = isPurchase
        ? row.purchasePricePence
        : pricePerCredit === null
          ? null
          : Math.round(row.amount * pricePerCredit);
      return {
        id: row.id,
        type: row.type,
        amount: row.amount,
        employerId: row.employerId,
        employerName: row.employerName,
        submissionId: row.submissionId,
        createdAt: row.createdAt,
        fiatPence,
        fiatUsd: fiatPence === null ? null : this.toUsd(fiatPence),
        fiatIsEstimate: !isPurchase,
      };
    });

    const totalPages = Math.ceil(total / limit);
    return {
      items,
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

  /** Everything ever paid for credit packs, and the credits those payments bought. */
  private async getPurchaseTotals(): Promise<PurchaseTotals> {
    const [row] = await this.db
      .select({
        pence: sql<number>`coalesce(sum(${creditPurchases.pricePence}), 0)::int`,
        credits: sql<number>`coalesce(sum(${creditLedgerEntries.amount}), 0)::int`,
      })
      .from(creditLedgerEntries)
      .innerJoin(
        creditPurchases,
        eq(creditLedgerEntries.creditPurchaseId, creditPurchases.id),
      )
      .where(eq(creditLedgerEntries.type, 'PURCHASE'));
    return row;
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
