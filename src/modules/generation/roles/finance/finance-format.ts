import { requireValid } from '../task-spec';

/** Amounts are shown and graded to the cent: an exact answer. */
export const CENT_TOLERANCE = 0.01;
/** Derived currency figures (variances, forecasts) may be rounded to the nearest whole unit. */
export const WHOLE_UNIT_TOLERANCE = 0.5;
/** Percentages are shown to one decimal place, so answers may differ by half of that. */
export const PERCENT_TOLERANCE = 0.05;

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Rejects a currency code the runtime cannot format, before it reaches a table. */
export function assertCurrency(code: string): void {
  let valid = true;
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: code });
  } catch {
    valid = false;
  }
  requireValid(valid, `unknown currency code "${code}"`);
}

/** Accounting format: negatives in parentheses, always two decimals. */
export function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencySign: 'accounting',
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
