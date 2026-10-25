import { TaskSpecError } from '../../role-module.interface';
import { reconciliationSpec } from './reconciliation.template';
import { journalEntrySpec, CASH_ACCOUNT, PPE_ACCOUNT, REPAIRS_ACCOUNT } from './journal-entry.template';
import { varianceSpec } from './variance.template';
import { forecastSpec } from './forecast.template';
import { statementAnalysisSpec } from './statement-analysis.template';

describe('reconciliationSpec', () => {
  const data = {
    currency: 'USD',
    periodEnd: '31 March 2027',
    adjustedBalance: 10000,
    items: [
      { description: 'Deposit in transit', kind: 'DEPOSIT_IN_TRANSIT', amount: 1000 },
      { description: 'Cheque 412', kind: 'OUTSTANDING_CHEQUE', amount: 500 },
      { description: 'Bank charges', kind: 'BANK_CHARGE', amount: 50 },
      { description: 'Interest earned', kind: 'BANK_INTEREST', amount: 30 },
      { description: 'NSF cheque', kind: 'NSF_CHEQUE', amount: 200 },
      { description: 'Customer direct payment', kind: 'BANK_COLLECTION', amount: 100 },
    ],
  };

  it('derives both balances so each reconciles to the adjusted balance', () => {
    const { interfacePayload } = reconciliationSpec.materialize(data);
    const rows = (interfacePayload.table as { rows: string[][] }).rows;

    // bank = 10000 - 1000 + 500 = 9500; ledger = 10000 - 30 - 100 + 50 + 200 = 10120
    expect(rows[0]).toEqual(['Balance per bank statement', '$9,500.00']);
    expect(rows[1]).toEqual(['Balance per cash ledger', '$10,120.00']);
    expect(rows).toHaveLength(2 + data.items.length);
  });

  it('keys each item to the side its kind belongs to', () => {
    const { objectiveComponent } = reconciliationSpec.materialize(data);
    expect(objectiveComponent).toMatchObject({
      items: data.items.map((item) => item.description),
      correctSides: ['BANK', 'BANK', 'BOOK', 'BOOK', 'BOOK', 'BOOK'],
      adjustedBalance: 10000,
      unit: 'USD',
    });
  });

  it('rejects inputs whose derived balance would be non-positive', () => {
    expect(() =>
      reconciliationSpec.materialize({ ...data, adjustedBalance: 100 }),
    ).toThrow(TaskSpecError);
  });

  it('rejects duplicate item descriptions, since the table rows must be unique', () => {
    const duplicate = { ...data, items: [data.items[0], { ...data.items[1], description: data.items[0].description }, data.items[2]] };
    expect(() => reconciliationSpec.materialize(duplicate)).toThrow(TaskSpecError);
  });
});

describe('journalEntrySpec', () => {
  const transactions = [
    { description: 'New delivery van', amount: 40000, treatment: 'CAPITALISE' },
    { description: 'Office window repair', amount: 300, treatment: 'EXPENSE' },
    { description: 'Warehouse extension', amount: 90000, treatment: 'AMBIGUOUS' },
  ];

  it('keys only the clear-cut transactions, each to a balanced entry', () => {
    const { objectiveComponent } = journalEntrySpec.materialize({ currency: 'USD', transactions });
    expect(objectiveComponent).toMatchObject({
      accounts: [CASH_ACCOUNT, PPE_ACCOUNT, REPAIRS_ACCOUNT],
      entries: [
        {
          reference: 'New delivery van',
          lines: [
            { account: PPE_ACCOUNT, side: 'DEBIT', amount: 40000 },
            { account: CASH_ACCOUNT, side: 'CREDIT', amount: 40000 },
          ],
        },
        {
          reference: 'Office window repair',
          lines: [
            { account: REPAIRS_ACCOUNT, side: 'DEBIT', amount: 300 },
            { account: CASH_ACCOUNT, side: 'CREDIT', amount: 300 },
          ],
        },
      ],
    });
  });

  it('requires exactly one ambiguous transaction', () => {
    const none = transactions.map((t) => ({ ...t, treatment: 'EXPENSE' }));
    expect(() => journalEntrySpec.materialize({ currency: 'USD', transactions: none })).toThrow(
      TaskSpecError,
    );
  });
});

describe('varianceSpec', () => {
  it('computes variance in currency and as a percentage of budget', () => {
    const { objectiveComponent } = varianceSpec.materialize({
      currency: 'USD',
      period: 'Q3 2027',
      lines: [
        { label: 'Marketing', budget: 100, actual: 110 },
        { label: 'Travel', budget: 200, actual: 150 },
        { label: 'Software', budget: 300, actual: 300 },
      ],
    });
    expect(objectiveComponent).toMatchObject({
      rowLabels: ['Marketing', 'Travel', 'Software'],
      correctValues: [
        [10, 10],
        [-50, -25],
        [0, 0],
      ],
    });
  });
});

describe('forecastSpec', () => {
  const base = { currency: 'USD', units: 1000, pricePerUnit: 10, variableCostPerUnit: 4, fixedCosts: 2000 };

  it('applies a price change and a one-off cost to the operating result', () => {
    const { objectiveComponent } = forecastSpec.materialize({
      ...base,
      change: { units: null, pricePerUnit: 12, oneOffCost: 500 },
    });
    // 1000 × (12 − 4) − 2000 − 500 = 5500
    expect(objectiveComponent).toMatchObject({ correctValue: 5500, unit: 'USD' });
  });

  it('requires the change to alter at least one figure', () => {
    expect(() =>
      forecastSpec.materialize({ ...base, change: { units: null, pricePerUnit: null, oneOffCost: null } }),
    ).toThrow(TaskSpecError);
  });
});

describe('statementAnalysisSpec', () => {
  it('derives margins and builds the chart from the same figures as the table', () => {
    const { interfacePayload, objectiveComponent } = statementAnalysisSpec.materialize({
      currency: 'USD',
      periods: [
        { label: 'FY2025', revenue: 1000, costOfSales: 600, operatingExpenses: 200 },
        { label: 'FY2026', revenue: 1200, costOfSales: 900, operatingExpenses: 200 },
      ],
    });

    // FY2025: gross 400 / 1000 = 40.0%, operating 200 / 1000 = 20.0%
    // FY2026: gross 300 / 1200 = 25.0%, operating 100 / 1200 = 8.3%
    expect(objectiveComponent).toMatchObject({
      rowLabels: ['FY2025', 'FY2026'],
      correctValues: [
        [40, 20],
        [25, 8.3],
      ],
    });
    expect(interfacePayload.chart).toMatchObject({
      type: 'bar',
      categories: ['FY2025', 'FY2026'],
      series: [
        { name: 'Revenue', values: [1000, 1200] },
        { name: 'Cost of sales', values: [600, 900] },
        { name: 'Operating expenses', values: [200, 200] },
      ],
    });
  });
});
