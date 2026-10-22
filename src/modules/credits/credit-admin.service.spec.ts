import type { ConfigService } from '@nestjs/config';
import type { DrizzleDb } from '../../db/client';
import { CreditAdminService } from './credit-admin.service';
import type { SignupBonusSettingsService } from './signup-bonus-settings.service';

const settings = {
  enabled: true,
  creditAmount: 10,
  updatedAt: null,
  updatedByName: null,
};

// Chainable stand-in for a drizzle query: every builder method returns the chain, and awaiting
// the chain resolves to `result`.
const query = (result: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'innerJoin', 'where', 'groupBy']) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
};

interface Fixtures {
  ledgerRows?: unknown[];
  purchases?: unknown[];
  allTimePence?: number;
  usdRate?: number | null;
}

const buildService = ({
  ledgerRows = [],
  purchases = [],
  allTimePence = 0,
  usdRate = null,
}: Fixtures = {}) => {
  const select = jest.fn((fields: Record<string, unknown>) => {
    if ('type' in fields) return query(ledgerRows);
    if ('paidAt' in fields) return query(purchases);
    return query([{ pence: allTimePence }]);
  });
  const db = { select } as unknown as DrizzleDb;
  const signupBonusSettings = {
    get: jest.fn().mockResolvedValue(settings),
  } as unknown as SignupBonusSettingsService;
  const config = { get: jest.fn().mockReturnValue(usdRate) } as unknown as ConfigService;
  return new CreditAdminService(db, signupBonusSettings, config);
};

describe('CreditAdminService.getOverview', () => {
  it('derives credit totals from the grouped ledger rows', async () => {
    const service = buildService({
      ledgerRows: [
        { type: 'SIGNUP_BONUS', entries: 3, credits: 30 },
        { type: 'PURCHASE', entries: 1, credits: 12 },
        { type: 'UNLOCK', entries: 5, credits: -5 },
      ],
    });

    const { signupBonus, totals } = await service.getOverview();

    expect(signupBonus).toEqual(settings);
    expect(totals).toEqual({
      signupBonusRecipients: 3,
      signupBonusCredits: 30,
      purchasedCredits: 12,
      creditsSpent: 5,
      outstandingCredits: 37,
    });
  });

  it('reports zeros when the ledger is empty', async () => {
    const { totals, revenue } = await buildService().getOverview();

    expect(totals).toEqual({
      signupBonusRecipients: 0,
      signupBonusCredits: 0,
      purchasedCredits: 0,
      creditsSpent: 0,
      outstandingCredits: 0,
    });
    expect(revenue).toEqual({ currency: 'GBP', usdRate: null, allTimeGbpPence: 0, allTimeUsd: null });
  });

  it('converts all-time revenue to USD at the configured rate', async () => {
    const service = buildService({ allTimePence: 40000, usdRate: 1.25 });

    const { revenue } = await service.getOverview();

    expect(revenue).toEqual({ currency: 'GBP', usdRate: 1.25, allTimeGbpPence: 40000, allTimeUsd: 500 });
  });
});

describe('CreditAdminService.getRevenue', () => {
  it('places a purchase in the bucket for the time it was paid', async () => {
    const service = buildService({
      purchases: [{ pricePence: 14900, paidAt: new Date() }],
      allTimePence: 14900,
      usdRate: 1.25,
    });

    const { totals, series } = await service.getRevenue('day');

    const lastBucket = series[series.length - 1];
    expect(lastBucket).toEqual({ label: expect.any(String), pence: 14900, usd: 186.25, purchases: 1 });
    expect(series.filter((point) => point.purchases > 0)).toHaveLength(1);
    expect(totals).toEqual({
      periodPence: 14900,
      periodUsd: 186.25,
      periodPurchases: 1,
      allTimePence: 14900,
      allTimeUsd: 186.25,
    });
  });

  it('leaves USD unset when no rate is configured', async () => {
    const service = buildService({ purchases: [{ pricePence: 4900, paidAt: new Date() }] });

    const { totals, series } = await service.getRevenue('week');

    expect(totals.periodUsd).toBeNull();
    expect(series.every((point) => point.usd === null)).toBe(true);
  });
});
