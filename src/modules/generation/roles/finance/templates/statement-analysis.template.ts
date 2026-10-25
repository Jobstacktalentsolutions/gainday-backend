import { z } from 'zod';
import { defineTaskSpec, requireUnique } from '../../task-spec';
import {
  assertCurrency,
  formatAmount,
  PERCENT_TOLERANCE,
  roundTo,
} from '../finance-format';

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  periods: z
    .array(
      z.object({
        label: z.string().describe('Period name, unique within the task, e.g. "FY2026".'),
        revenue: z.number().positive(),
        costOfSales: z.number().nonnegative(),
        operatingExpenses: z.number().nonnegative(),
      }),
    )
    .min(2)
    .max(4),
});

// Margin analysis across periods (finance doc Section 2.6). The table and the chart are built from
// the same figures, so they cannot disagree. The candidate computes the margins.
export const statementAnalysisSpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  requireUnique(
    data.periods.map((period) => period.label),
    'period labels',
  );

  const money = (value: number) => formatAmount(value, data.currency);
  const margin = (profit: number, revenue: number) =>
    roundTo((profit / revenue) * 100, 1);

  const margins = data.periods.map((period) => {
    const grossProfit = period.revenue - period.costOfSales;
    return {
      label: period.label,
      grossMargin: margin(grossProfit, period.revenue),
      operatingMargin: margin(grossProfit - period.operatingExpenses, period.revenue),
    };
  });

  return {
    interfacePayload: {
      table: {
        columns: [
          'Period',
          `Revenue (${data.currency})`,
          `Cost of sales (${data.currency})`,
          `Operating expenses (${data.currency})`,
        ],
        rows: data.periods.map((period) => [
          period.label,
          money(period.revenue),
          money(period.costOfSales),
          money(period.operatingExpenses),
        ]),
      },
      chart: {
        type: 'bar',
        categories: data.periods.map((period) => period.label),
        series: [
          { name: 'Revenue', values: data.periods.map((p) => p.revenue) },
          { name: 'Cost of sales', values: data.periods.map((p) => p.costOfSales) },
          {
            name: 'Operating expenses',
            values: data.periods.map((p) => p.operatingExpenses),
          },
        ],
      },
      placeholder: null,
    },
    objectiveComponent: {
      rowLabels: margins.map((period) => period.label),
      columns: [
        { label: 'Gross margin (%)', tolerance: PERCENT_TOLERANCE },
        { label: 'Operating margin (%)', tolerance: PERCENT_TOLERANCE },
      ],
      correctValues: margins.map((period) => [
        period.grossMargin,
        period.operatingMargin,
      ]),
    },
  };
});
