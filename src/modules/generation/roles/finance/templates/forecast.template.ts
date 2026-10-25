import { z } from 'zod';
import { defineTaskSpec, requireValid } from '../../task-spec';
import {
  assertCurrency,
  formatAmount,
  formatNumber,
  roundTo,
  WHOLE_UNIT_TOLERANCE,
} from '../finance-format';

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  units: z.number().positive().describe('Units sold in the base forecast.'),
  pricePerUnit: z.number().positive(),
  variableCostPerUnit: z.number().nonnegative(),
  fixedCosts: z.number().nonnegative(),
  change: z
    .object({
      units: z
        .number()
        .positive()
        .nullable()
        .describe('Revised units, or null if unchanged.'),
      pricePerUnit: z
        .number()
        .positive()
        .nullable()
        .describe('Revised price per unit, or null if unchanged.'),
      oneOffCost: z
        .number()
        .nonnegative()
        .nullable()
        .describe('A one-off cost in the forecast period, or null if none.'),
    })
    .describe('The change the candidate must reflect. At least one field must be non-null.'),
});

// Forecast update after a volume, price or one-off cost change (finance doc Section 2.5). The
// candidate computes the revised operating result.
export const forecastSpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  const { change } = data;
  requireValid(
    change.units !== null || change.pricePerUnit !== null || change.oneOffCost !== null,
    'the forecast change must alter at least one figure',
  );

  const revisedUnits = change.units === null ? data.units : change.units;
  const revisedPrice =
    change.pricePerUnit === null ? data.pricePerUnit : change.pricePerUnit;
  const oneOffCost = change.oneOffCost === null ? 0 : change.oneOffCost;
  const operatingResult = roundTo(
    revisedUnits * (revisedPrice - data.variableCostPerUnit) -
      data.fixedCosts -
      oneOffCost,
    2,
  );

  const money = (value: number) => formatAmount(value, data.currency);
  return {
    interfacePayload: {
      table: {
        columns: ['Assumption', `Base (${data.currency})`, `Revised (${data.currency})`],
        rows: [
          ['Units sold', formatNumber(data.units), formatNumber(revisedUnits)],
          ['Price per unit', money(data.pricePerUnit), money(revisedPrice)],
          [
            'Variable cost per unit',
            money(data.variableCostPerUnit),
            money(data.variableCostPerUnit),
          ],
          ['Fixed costs', money(data.fixedCosts), money(data.fixedCosts)],
          ['One-off cost', money(0), money(oneOffCost)],
        ],
      },
      placeholder: null,
    },
    objectiveComponent: {
      correctValue: operatingResult,
      tolerance: WHOLE_UNIT_TOLERANCE,
      unit: data.currency,
    },
  };
});
