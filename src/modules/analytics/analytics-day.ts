import { analyticsConfig } from '../../config/analytics.config';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: analyticsConfig.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The London calendar day (YYYY-MM-DD) that contains the instant. */
export function dayKeyOf(instant: Date): string {
  return dayFormatter.format(instant);
}

/** Adds calendar days to a YYYY-MM-DD string. Pure calendar arithmetic, no timezone involved. */
export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** The first day of the month `monthsBack` months before the month containing `day`. */
export function firstDayOfMonth(day: string, monthsBack = 0): string {
  const [year, month] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 - monthsBack, 1))
    .toISOString()
    .slice(0, 10);
}

/** Every YYYY-MM-DD from `from` to `to`, inclusive. Empty when `from` is after `to`. */
export function listDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

/** Every YYYY-MM from the month of `from` to the month of `to`, inclusive. */
export function listMonths(from: string, to: string): string[] {
  const months: string[] = [];
  for (
    let day = firstDayOfMonth(from);
    day.slice(0, 7) <= to.slice(0, 7);
    day = firstDayOfMonth(day, -1)
  ) {
    months.push(day.slice(0, 7));
  }
  return months;
}
