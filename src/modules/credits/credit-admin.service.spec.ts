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
  for (const method of [
    'from',
    'innerJoin',
    'leftJoin',
    'where',
    'groupBy',
    'orderBy',
    'limit',
    'offset',
  ]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
};

interface Fixtures {
  ledgerRows?: unknown[];
  purchases?: unknown[];
  listRows?: unknown[];
  listTotal?: number;
  purchaseTotals?: { pence: number; credits: number };
  usdRate?: number | null;
}

// The mock routes each query by the fields it selects, mirroring the queries in the service.
const buildService = ({
  ledgerRows = [],
  purchases = [],
  listRows = [],
  listTotal = 0,
  purchaseTotals = { pence: 0, credits: 0 },
  usdRate = null,
}: Fixtures = {}) => {
  const select = jest.fn((fields: Record<string, unknown>) => {
    if ('total' in fields) return query([{ total: listTotal }]);
    if ('employerName' in fields) return query(listRows);
    if ('type' in fields) return query(ledgerRows);
    if ('paidAt' in fields) return query(purchases);
    return query([purchaseTotals]);
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
    const service = buildService({ purchaseTotals: { pence: 40000, credits: 0 }, usdRate: 1.25 });

    const { revenue } = await service.getOverview();

    expect(revenue).toEqual({ currency: 'GBP', usdRate: 1.25, allTimeGbpPence: 40000, allTimeUsd: 500 });
  });
});

describe('CreditAdminService.getRevenue', () => {
  it('places a purchase in the bucket for the time it was paid', async () => {
    const service = buildService({
      purchases: [{ pricePence: 14900, paidAt: new Date() }],
      purchaseTotals: { pence: 14900, credits: 5 },
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

describe('CreditAdminService.listLedger', () => {
  it('values purchases at the price paid and other rows at the average price per credit', async () => {
    const service = buildService({
      listTotal: 2,
      listRows: [
        {
          id: 'purchase-row',
          type: 'PURCHASE',
          amount: 5,
          employerId: 'e1',
          employerName: 'Acme',
          submissionId: null,
          createdAt: new Date('2026-10-01'),
          purchasePricePence: 14900,
        },
        {
          id: 'unlock-row',
          type: 'UNLOCK',
          amount: -1,
          employerId: 'e1',
          employerName: 'Acme',
          submissionId: 's1',
          createdAt: new Date('2026-10-02'),
          purchasePricePence: null,
        },
      ],
      // 14900p for 5 credits = 2980p per credit.
      purchaseTotals: { pence: 14900, credits: 5 },
      usdRate: 1.25,
    });

    const { items } = await service.listLedger({ page: 1, limit: 10 });

    expect(items[0]).toMatchObject({ fiatPence: 14900, fiatUsd: 186.25, fiatIsEstimate: false });
    expect(items[1]).toMatchObject({ fiatPence: -2980, fiatUsd: -37.25, fiatIsEstimate: true });
  });

  it('leaves non-purchase rows unvalued when no purchase exists yet', async () => {
    const service = buildService({
      listTotal: 1,
      listRows: [
        {
          id: 'bonus-row',
          type: 'SIGNUP_BONUS',
          amount: 10,
          employerId: 'e1',
          employerName: null,
          submissionId: null,
          createdAt: new Date('2026-10-01'),
          purchasePricePence: null,
        },
      ],
    });

    const { items } = await service.listLedger({ page: 1, limit: 10 });

    expect(items[0]).toMatchObject({ fiatPence: null, fiatUsd: null, fiatIsEstimate: true });
  });
});
