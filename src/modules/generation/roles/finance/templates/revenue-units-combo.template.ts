import { z } from 'zod';
import { defineTaskSpec, requireUnique, requireValid } from '../../task-spec';
import { assertCurrency, CENT_TOLERANCE, formatAmount, formatNumber, roundTo } from '../finance-format';

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  periods: z
    .array(
      z.object({
        label: z.string().describe('Period label, unique within the task, e.g. "Q1 2027".'),
        revenue: z.number().positive(),
        unitsSold: z.number().int().positive(),
      }),
    )
    .min(3)
    .max(6),
});

// Revenue as bars, units sold as a line on a second axis (finance doc Section 5, combo chart). Both are
// inputs. The candidate computes revenue per unit for each period, which the chart does not state.
export const revenueUnitsComboSpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  requireUnique(
    data.periods.map((period) => period.label),
    'period labels',
  );
  const perUnit = data.periods.map((period) => roundTo(period.revenue / period.unitsSold, 2));
  requireValid(
    perUnit.every((value) => value > 0),
    'a period has no revenue per unit',
  );

  const money = (value: number) => formatAmount(value, data.currency);
  return {
    interfacePayload: {
      table: {
        columns: ['Period', `Revenue (${data.currency})`, 'Units sold'],
        rows: data.periods.map((period) => [period.label, money(period.revenue), formatNumber(period.unitsSold)]),
      },
      chart: {
        type: 'combo',
        categories: data.periods.map((period) => period.label),
        series: [
          {
            name: 'Revenue',
            values: data.periods.map((period) => period.revenue),
            kind: 'bar',
            axis: 'primary',
          },
          {
            name: 'Units sold',
            values: data.periods.map((period) => period.unitsSold),
            kind: 'line',
            axis: 'secondary',
          },
        ],
      },
      placeholder: null,
    },
    objectiveComponent: {
      rowLabels: data.periods.map((period) => period.label),
      columns: [{ label: `Revenue per unit (${data.currency})`, tolerance: CENT_TOLERANCE }],
      correctValues: perUnit.map((value) => [value]),
    },
  };
});
