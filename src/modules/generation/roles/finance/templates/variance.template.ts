import { z } from 'zod';
import { defineTaskSpec, requireUnique } from '../../task-spec';
import {
  assertCurrency,
  formatAmount,
  PERCENT_TOLERANCE,
  roundTo,
  WHOLE_UNIT_TOLERANCE,
} from '../finance-format';

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  period: z
    .string()
    .describe('Reporting period as the scenario states it, e.g. "Q3 2027".'),
  lines: z
    .array(
      z.object({
        label: z.string().describe('Budget line name, unique within the task.'),
        budget: z.number().positive(),
        actual: z.number().nonnegative(),
      }),
    )
    .min(3)
    .max(6),
});

// Budget-vs-actual variance (finance doc Section 2.3). Variance is actual minus budget; the
// percentage is of budget. Both are graded as a numeric table.
export const varianceSpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  requireUnique(
    data.lines.map((line) => line.label),
    'budget line labels',
  );

  const money = (value: number) => formatAmount(value, data.currency);
  const variances = data.lines.map((line) => {
    const variance = roundTo(line.actual - line.budget, 2);
    return { variance, percent: roundTo((variance / line.budget) * 100, 1) };
  });

  return {
    interfacePayload: {
      table: {
        columns: [
          'Line',
          `Budget (${data.currency}, ${data.period})`,
          `Actual (${data.currency}, ${data.period})`,
        ],
        rows: data.lines.map((line) => [
          line.label,
          money(line.budget),
          money(line.actual),
        ]),
      },
      placeholder: null,
    },
    objectiveComponent: {
      rowLabels: data.lines.map((line) => line.label),
      columns: [
        { label: `Variance (${data.currency})`, tolerance: WHOLE_UNIT_TOLERANCE },
        { label: 'Variance (%)', tolerance: PERCENT_TOLERANCE },
      ],
      correctValues: variances.map(({ variance, percent }) => [variance, percent]),
    },
  };
});
