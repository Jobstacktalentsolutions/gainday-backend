import { requireValid } from '../task-spec';
import { MaterializedTaskData } from '../role-module.interface';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses a YYYY-MM-DD date the model supplies. Anything else is rejected, not guessed at. */
export function isoDate(value: string): Date {
  requireValid(/^\d{4}-\d{2}-\d{2}$/.test(value), `"${value}" is not a YYYY-MM-DD date`);
  const date = new Date(`${value}T00:00:00Z`);
  requireValid(!Number.isNaN(date.getTime()), `"${value}" is not a real date`);
  return date;
}

export function formatDate(value: string): string {
  return isoDate(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** A two-column Markdown table of label/value facts. Pipes in a value are escaped. */
export function factTable(
  rows: [string, string][],
  headers: [string, string] = ['Field', 'Value'],
): string {
  const escape = (text: string) => text.replace(/\|/g, '\|');
  return [
    `| ${headers[0]} | ${headers[1]} |`,
    '|---|---|',
    ...rows.map(([label, value]) => `| ${escape(label)} | ${escape(value)} |`),
  ].join('\n');
}

export function caseFilePayload(
  tabs: { label: string; content: string }[],
  wordLimit: { min: number; max: number },
): MaterializedTaskData['interfacePayload'] {
  return {
    caseFile: { tabs },
    wordLimit,
    placeholder: null,
  };
}
