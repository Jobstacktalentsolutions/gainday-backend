import { RoleCategory } from '../role-category.enum';

const SUPPORTED = Object.values(RoleCategory) as string[];

/**
 * Whether an inferred role matches the expectation. A supported role must match its top level exactly
 * (the sub-role is free). "OTHER" matches any top level that is not a supported role.
 */
export function isCorrect(inferred: string, expected: string): boolean {
  const top = inferred.split('>')[0].trim().toLowerCase();
  if (expected === 'OTHER') return !SUPPORTED.some((role) => role.toLowerCase() === top);
  return top === expected.toLowerCase();
}
