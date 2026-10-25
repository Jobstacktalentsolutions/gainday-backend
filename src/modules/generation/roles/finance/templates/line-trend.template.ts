import { z } from 'zod';
import { defineTaskSpec, requireUnique, requireValid } from '../../task-spec';
import { assertCurrency, formatAmount, PERCENT_TOLERANCE, roundTo } from '../finance-format';

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  periods: z
    .array(
      z.object({
        label: z.string().describe('Period label, unique within the task, e.g. "Jan 2027".'),
        revenue: z.number().positive(),
      }),
    )
    .min(4)
    .max(8)
    .describe('Revenue for each period, in time order.'),
});

// Trend over periods (finance doc Section 5, line chart). The chart shows the revenue inputs only; the
// candidate computes the change across the whole period, which the chart does not state.
export const lineTrendSpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  requireUnique(
    data.periods.map((period) => period.label),
    'period labels',
  );
  const first = data.periods[0].revenue;
  const last = data.periods[data.periods.length - 1].revenue;
  requireValid(first > 0, 'the first period has no revenue to measure growth from');

  const change = roundTo(((last - first) / first) * 100, 1);
  const money = (value: number) => formatAmount(value, data.currency);

  return {
    interfacePayload: {
      table: {
        columns: ['Period', `Revenue (${data.currency})`],
        rows: data.periods.map((period) => [period.label, money(period.revenue)]),
      },
      chart: {
        type: 'line',
        categories: data.periods.map((period) => period.label),
        series: [{ name: 'Revenue', values: data.periods.map((period) => period.revenue) }],
      },
      placeholder: null,
    },
    objectiveComponent: {
      correctValue: change,
      tolerance: PERCENT_TOLERANCE,
      unit: '%',
    },
  };
});
