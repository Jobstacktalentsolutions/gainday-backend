import { or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

/** Match literal substrings and approximate words, including within longer titles. */
export function fuzzySearch(query: string, columns: SQLWrapper[]): SQL {
  const term = query.trim();
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  return or(...columns.map((column) => sql`(${column} ILIKE ${pattern} ESCAPE chr(92) OR ${term} <% ${column})`))!;
}

export function fuzzySearchArray(query: string, column: SQLWrapper): SQL {
  const term = query.trim();
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  return sql`EXISTS (SELECT 1 FROM unnest(${column}) AS skill(value) WHERE skill.value ILIKE ${pattern} ESCAPE chr(92) OR ${term} <% skill.value)`;
}
