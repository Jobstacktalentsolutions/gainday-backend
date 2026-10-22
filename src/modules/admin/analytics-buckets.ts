export type AnalyticsTimeframe = 'day' | 'week' | 'month' | 'year' | 'all';

export interface TimeBucket {
  label: string;
  startTime: number;
  endTime: number;
}

/**
 * Consecutive time windows for an admin analytics timeframe, oldest first. Shared by the
 * dashboard activity series and the revenue series so both chart the same periods.
 */
export function buildTimeBuckets(
  timeframe: AnalyticsTimeframe,
  now = new Date(),
): TimeBucket[] {
  const buckets: TimeBucket[] = [];

  if (timeframe === 'day') {
    // 24 hourly buckets
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const start = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        0,
        0,
      ).getTime();
      const end = start + 60 * 60 * 1000;
      const hourStr = `${d.getHours().toString().padStart(2, '0')}:00`;
      buckets.push({
        label: hourStr,
        startTime: start,
        endTime: end,
      });
    }
  } else if (timeframe === 'week') {
    // 7 daily buckets
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const start = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        0,
        0,
        0,
      ).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const label = `${dayNames[d.getDay()]} ${d.getDate()}`;
      buckets.push({
        label,
        startTime: start,
        endTime: end,
      });
    }
  } else if (timeframe === 'month') {
    // 30 daily buckets (or 15 two-day steps)
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const start = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        0,
        0,
        0,
      ).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
      buckets.push({
        label,
        startTime: start,
        endTime: end,
      });
    }
  } else if (timeframe === 'year' || timeframe === 'all') {
    // 12 monthly buckets
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthsCount = timeframe === 'all' ? 12 : 12;
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const end = nextMonth.getTime();
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      buckets.push({
        label,
        startTime: start,
        endTime: end,
      });
    }
  }
  return buckets;
}
