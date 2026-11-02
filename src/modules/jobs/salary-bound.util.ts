/**
 * Normalises one salary bound for storage. Only a positive amount the employer entered is kept;
 * a missing, null, zero or negative value is stored as null, which means "not provided".
 */
export function toSalaryBound(value: number | null | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}
