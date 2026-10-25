import type { ParsedJobDescription } from './schemas/parsed-job-description.schema';

// Words the model writes in place of a value it could not find. Matched against the whole field
// only, so real text that merely contains one of these words is kept.
const PLACEHOLDER_TEXT = new Set([
  'null',
  'none',
  'n/a',
  'na',
  'not specified',
  'not stated',
  'unknown',
]);

function isPlaceholderText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === '' || PLACEHOLDER_TEXT.has(normalized);
}

// Returns the value to keep, or undefined when the model left the field unspecified.
function cleanValue(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  // Salaries are the only numbers, and a salary must be positive. `false` is kept: it is a real
  // answer for isRemoteFriendly.
  if (typeof value === 'number') return value > 0 ? value : undefined;
  if (typeof value === 'string')
    return isPlaceholderText(value) ? undefined : value;
  if (Array.isArray(value)) {
    const items = value.filter(
      (item): item is string =>
        typeof item === 'string' && !isPlaceholderText(item),
    );
    return items.length > 0 ? items : undefined;
  }
  return value;
}

/**
 * Drops the fields the model could not determine from the posting, however it wrote them: real
 * nulls, empty values, placeholder words such as "null" or "N/A", and non-positive salaries. A
 * salary range whose upper bound is below its lower bound drops the upper bound. The result only
 * carries what the posting actually specified.
 */
export function dropUnspecifiedFields(
  parsed: ParsedJobDescription,
): Partial<ParsedJobDescription> {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const cleaned = cleanValue(value);
    if (cleaned !== undefined) kept[key] = cleaned;
  }
  if (
    typeof kept.salaryFrom === 'number' &&
    typeof kept.salaryTo === 'number' &&
    kept.salaryTo < kept.salaryFrom
  ) {
    delete kept.salaryTo;
  }
  return kept as Partial<ParsedJobDescription>;
}
