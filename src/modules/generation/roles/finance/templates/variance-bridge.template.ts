import { z } from 'zod';
import { defineTaskSpec, requireUnique, requireValid } from '../../task-spec';
import { assertCurrency, formatAmount, roundTo, WHOLE_UNIT_TOLERANCE } from '../finance-format';

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  period: z.string().describe('Reporting period as the scenario states it, e.g. "Q3 2027".'),
  budget: z.number().positive(),
  actual: z.number().positive(),
  drivers: z
    .array(
      z.object({
        label: z.string().describe('A named driver of the variance, unique within the task, e.g. "Price increase".'),
        amount: z.number().describe('Signed effect on the result: positive raises it, negative lowers it.'),
      }),
    )
    .min(3)
    .max(5)
    .describe('The drivers you can name. The candidate must account for the difference left after these.'),
});

// Variance bridge (finance doc Section 5, waterfall chart): budget, named drivers, then actual. The
// unexplained remainder is the candidate's to compute; it is not drawn on the chart.
export const varianceBridgeSpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  requireUnique(
    data.drivers.map((driver) => driver.label),
    'driver labels',
  );
  requireValid(
    data.drivers.every((driver) => driver.amount !== 0),
    'a driver has no effect',
  );
  const named = data.drivers.reduce((total, driver) => total + driver.amount, 0);
  const unexplained = roundTo(data.actual - data.budget - named, 2);
  requireValid(Math.abs(unexplained) >= 1, 'the drivers already explain the whole variance');

  const money = (value: number) => formatAmount(value, data.currency);
  const labels = ['Budget', ...data.drivers.map((driver) => driver.label), 'Actual'];
  const values = [data.budget, ...data.drivers.map((driver) => driver.amount), data.actual];

  return {
    interfacePayload: {
      table: {
        columns: ['Item', `Amount (${data.currency}, ${data.period})`],
        rows: [
          ['Budget', money(data.budget)],
          ...data.drivers.map((driver) => [driver.label, money(driver.amount)]),
          ['Actual', money(data.actual)],
        ],
      },
      chart: {
        type: 'waterfall',
        categories: labels,
        values,
        totals: labels.map((_label, index) => index === 0 || index === labels.length - 1),
      },
      placeholder: null,
    },
    objectiveComponent: {
      correctValue: unexplained,
      tolerance: WHOLE_UNIT_TOLERANCE,
      unit: data.currency,
    },
  };
});
