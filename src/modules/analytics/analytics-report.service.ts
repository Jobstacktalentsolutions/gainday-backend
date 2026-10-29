import { Inject, Injectable } from '@nestjs/common';
import { and, gte, lte, sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { analyticsConfig } from '../../config/analytics.config';
import type { DrizzleDb } from '../../db/client';
import { DRIZZLE } from '../../db/db.constants';
import { Audience, dailyVisitorStats } from '../../db/schema';
import type { AnalyticsTimeframe } from '../admin/analytics-buckets';
import { REDIS } from '../redis/redis.constants';
import { analyticsKeys } from './analytics.constants';
import {
  addDays,
  dayKeyOf,
  firstDayOfMonth,
  listDays,
  listMonths,
} from './analytics-day';
import { toAudience } from './analytics-audience';
import { readHash, sumCounters } from './analytics-redis.util';

/** Days charted for the short timeframes. Year and all are charted by month. */
const DAILY_POINTS: Partial<Record<AnalyticsTimeframe, number>> = {
  day: 7,
  week: 7,
  month: 30,
};

const MONTH_NAMES = [
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

/** Distinct visitors per audience, with the total across all of them. */
export interface AudienceCounts {
  total: number;
  anonymous: number;
  jobSeeker: number;
  employer: number;
}

/**
 * One point on the chart. Each audience is counted separately, so a visitor who was anonymous on one
 * day and signed in on another appears in both. Monthly totals can therefore be lower than the sum.
 */
export interface VisitorSeriesPoint {
  label: string;
  anonymous: number;
  jobSeeker: number;
  employer: number;
  /** Distinct visitors over the 30 days ending on the day. Null on monthly points. */
  mau: number | null;
}

export interface VisitorReport {
  timeframe: AnalyticsTimeframe;
  kpis: {
    /** Visitors today so far. */
    dau: AudienceCounts;
    /** Distinct visitors over the last 30 days, including today. */
    mau: AudienceCounts;
    /** Total DAU divided by total MAU: how many of the month's visitors came back today. */
    stickiness: number;
    /** Over the timeframe. */
    newVisitors: number;
    /** All time. */
    totalVisitors: number;
    /** Over the timeframe. */
    sessions: number;
    pageViews: number;
  };
  series: VisitorSeriesPoint[];
}

interface LiveActivity {
  /** Today's visitors, each with the audience recorded for them today. */
  audienceByVisitor: Map<string, Audience>;
  sessions: number;
  pageViews: number;
}

/** Postgres array literal for bound UUIDs. Drizzle would expand a plain JS array into separate parameters. */
function pgUuidArray(ids: string[]): string {
  return `{${ids.join(',')}}`;
}

function labelOfDay(day: string): string {
  const [, month, dayOfMonth] = day.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${dayOfMonth}`;
}

function labelOfMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${MONTH_NAMES[monthNumber - 1]} ${String(year).slice(-2)}`;
}

function idsOf(live: LiveActivity, audience?: Audience): string[] {
  return [...live.audienceByVisitor]
    .filter(([, value]) => audience === undefined || value === audience)
    .map(([visitorId]) => visitorId);
}

function countsOf(live: LiveActivity): AudienceCounts {
  return {
    total: live.audienceByVisitor.size,
    anonymous: idsOf(live, Audience.ANONYMOUS).length,
    jobSeeker: idsOf(live, Audience.JOB_SEEKER).length,
    employer: idsOf(live, Audience.EMPLOYER).length,
  };
}

/**
 * Builds the visitor analytics for the admin overview. Today is read live from Redis because the
 * sync has not run for it yet; every earlier day comes from the daily rollup in Postgres.
 *
 * A day or month the rollup has no row for had no visitors, since the sync writes a row for every
 * day that had any.
 */
@Injectable()
export class AnalyticsReportService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
  ) {}

  async getReport(
    timeframe: AnalyticsTimeframe,
    now = new Date(),
  ): Promise<VisitorReport> {
    const today = dayKeyOf(now);
    const yesterday = addDays(today, -1);
    const rollingStart = addDays(
      today,
      -(analyticsConfig.rollingWindowDays - 1),
    );
    const windowStart = await this.windowStart(timeframe, today);

    const live = await this.readLive(today);
    const [history, newToday, totalSaved, mau] = await Promise.all([
      this.historyTotals(windowStart, yesterday),
      this.countNewLiveVisitors(idsOf(live)),
      this.countAllVisitors(),
      this.countWindow(rollingStart, yesterday, live),
    ]);

    const dau = countsOf(live);
    const series = await this.buildSeries(
      timeframe,
      windowStart,
      today,
      yesterday,
      live,
      mau.total,
    );

    return {
      timeframe,
      kpis: {
        dau,
        mau,
        stickiness: mau.total === 0 ? 0 : dau.total / mau.total,
        newVisitors: history.newVisitors + newToday,
        totalVisitors: totalSaved + newToday,
        sessions: history.sessions + live.sessions,
        pageViews: history.pageViews + live.pageViews,
      },
      series,
    };
  }

  private async windowStart(
    timeframe: AnalyticsTimeframe,
    today: string,
  ): Promise<string> {
    const dailyPoints = DAILY_POINTS[timeframe];
    if (dailyPoints !== undefined) return addDays(today, -(dailyPoints - 1));
    if (timeframe === 'year') return firstDayOfMonth(today, 11);

    // All time starts at the first visitor on record. With nothing synced yet, that is today.
    const { rows } = await this.db.execute<{ first: string | null }>(sql`
      SELECT min(first_seen_on)::text AS first FROM visitors
    `);
    return rows[0].first ?? today;
  }

  private async readLive(today: string): Promise<LiveActivity> {
    const [audienceHash, pageViewHash, sessionHash] = await Promise.all([
      readHash(this.redis, analyticsKeys.visitors(today)),
      readHash(this.redis, analyticsKeys.pageViews(today)),
      readHash(this.redis, analyticsKeys.sessions(today)),
    ]);

    const audienceByVisitor = new Map<string, Audience>();
    for (const [visitorId, value] of audienceHash) {
      audienceByVisitor.set(visitorId, toAudience(value));
    }

    return {
      audienceByVisitor,
      sessions: sumCounters(sessionHash),
      pageViews: sumCounters(pageViewHash),
    };
  }

  private async buildSeries(
    timeframe: AnalyticsTimeframe,
    windowStart: string,
    today: string,
    yesterday: string,
    live: LiveActivity,
    todayMau: number,
  ): Promise<VisitorSeriesPoint[]> {
    if (DAILY_POINTS[timeframe] !== undefined) {
      return this.dailySeries(windowStart, today, yesterday, live, todayMau);
    }
    return this.monthlySeries(windowStart, today, yesterday, live);
  }

  private async dailySeries(
    windowStart: string,
    today: string,
    yesterday: string,
    live: LiveActivity,
    todayMau: number,
  ): Promise<VisitorSeriesPoint[]> {
    const rows = await this.db
      .select()
      .from(dailyVisitorStats)
      .where(
        and(
          gte(dailyVisitorStats.day, windowStart),
          lte(dailyVisitorStats.day, yesterday),
        ),
      );
    const byDay = new Map(rows.map((row) => [row.day, row]));

    return listDays(windowStart, today).map((day) => {
      if (day === today) {
        const counts = countsOf(live);
        return {
          label: labelOfDay(day),
          anonymous: counts.anonymous,
          jobSeeker: counts.jobSeeker,
          employer: counts.employer,
          mau: todayMau,
        };
      }
      const row = byDay.get(day);
      return {
        label: labelOfDay(day),
        anonymous: row?.anonymousVisitors ?? 0,
        jobSeeker: row?.jobSeekerVisitors ?? 0,
        employer: row?.employerVisitors ?? 0,
        mau: row?.rolling30dVisitors ?? 0,
      };
    });
  }

  private async monthlySeries(
    windowStart: string,
    today: string,
    yesterday: string,
    live: LiveActivity,
  ): Promise<VisitorSeriesPoint[]> {
    const { rows } = await this.db.execute<{
      month: string;
      anonymous: number;
      job_seeker: number;
      employer: number;
    }>(sql`
      SELECT to_char(day, 'YYYY-MM') AS month,
        count(DISTINCT visitor_id) FILTER (WHERE audience = ${Audience.ANONYMOUS})::int AS anonymous,
        count(DISTINCT visitor_id) FILTER (WHERE audience = ${Audience.JOB_SEEKER})::int AS job_seeker,
        count(DISTINCT visitor_id) FILTER (WHERE audience = ${Audience.EMPLOYER})::int AS employer
      FROM visitor_daily_activity
      WHERE day BETWEEN ${windowStart}::date AND ${yesterday}::date
      GROUP BY 1
    `);
    const byMonth = new Map(rows.map((row) => [row.month, row]));

    const currentMonth = today.slice(0, 7);
    const current = await this.countWindow(
      firstDayOfMonth(today),
      yesterday,
      live,
    );

    return listMonths(windowStart, today).map((month) => {
      if (month === currentMonth) {
        return {
          label: labelOfMonth(month),
          anonymous: current.anonymous,
          jobSeeker: current.jobSeeker,
          employer: current.employer,
          mau: null,
        };
      }
      const row = byMonth.get(month);
      return {
        label: labelOfMonth(month),
        anonymous: row?.anonymous ?? 0,
        jobSeeker: row?.job_seeker ?? 0,
        employer: row?.employer ?? 0,
        mau: null,
      };
    });
  }

  /** Distinct visitors per audience in synced days from `from` to `to`, plus today's live visitors. */
  private async countWindow(
    from: string,
    to: string,
    live: LiveActivity,
  ): Promise<AudienceCounts> {
    const [total, anonymous, jobSeeker, employer] = await Promise.all([
      this.countDistinctVisitors(from, to, idsOf(live)),
      this.countDistinctVisitors(
        from,
        to,
        idsOf(live, Audience.ANONYMOUS),
        Audience.ANONYMOUS,
      ),
      this.countDistinctVisitors(
        from,
        to,
        idsOf(live, Audience.JOB_SEEKER),
        Audience.JOB_SEEKER,
      ),
      this.countDistinctVisitors(
        from,
        to,
        idsOf(live, Audience.EMPLOYER),
        Audience.EMPLOYER,
      ),
    ]);
    return { total, anonymous, jobSeeker, employer };
  }

  private async countDistinctVisitors(
    from: string,
    to: string,
    liveIds: string[],
    audience?: Audience,
  ): Promise<number> {
    const audienceFilter =
      audience === undefined ? sql`` : sql`AND audience = ${audience}`;
    const { rows } = await this.db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM (
        SELECT visitor_id FROM visitor_daily_activity
        WHERE day BETWEEN ${from}::date AND ${to}::date ${audienceFilter}
        UNION
        SELECT unnest(${pgUuidArray(liveIds)}::uuid[])
      ) AS active
    `);
    return rows[0].count;
  }

  private async historyTotals(
    from: string,
    to: string,
  ): Promise<{ newVisitors: number; sessions: number; pageViews: number }> {
    const { rows } = await this.db.execute<{
      new_visitors: number;
      sessions: number;
      page_views: number;
    }>(sql`
      SELECT coalesce(sum(new_visitors), 0)::int AS new_visitors,
        coalesce(sum(sessions), 0)::int AS sessions,
        coalesce(sum(page_views), 0)::int AS page_views
      FROM daily_visitor_stats
      WHERE day BETWEEN ${from}::date AND ${to}::date
    `);
    return {
      newVisitors: rows[0].new_visitors,
      sessions: rows[0].sessions,
      pageViews: rows[0].page_views,
    };
  }

  /** Live visitors that the sync has not yet recorded, so they are new today. */
  private async countNewLiveVisitors(liveIds: string[]): Promise<number> {
    const { rows } = await this.db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count
      FROM unnest(${pgUuidArray(liveIds)}::uuid[]) AS live(visitor_id)
      WHERE NOT EXISTS (SELECT 1 FROM visitors v WHERE v.id = live.visitor_id)
    `);
    return rows[0].count;
  }

  private async countAllVisitors(): Promise<number> {
    const { rows } = await this.db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM visitors
    `);
    return rows[0].count;
  }
}
