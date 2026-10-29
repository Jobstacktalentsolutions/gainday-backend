import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { analyticsConfig } from '../../config/analytics.config';
import type { DrizzleDb } from '../../db/client';
import { DRIZZLE } from '../../db/db.constants';
import { Audience, visitorDailyActivity, visitors } from '../../db/schema';
import { toAudience } from './analytics-audience';
import { REDIS } from '../redis/redis.constants';
import {
  analyticsKeys,
  DAY_KEY_PATTERN,
  DAY_KEY_REGEX,
} from './analytics.constants';
import { dayKeyOf } from './analytics-day';
import { readHash } from './analytics-redis.util';

const WRITE_BATCH_SIZE = 1000;
/**
 * Moves each finished London day from Redis into Postgres, then drops that day's Redis keys. A day
 * is written in one transaction and its keys are removed only after it commits, so a failed run is
 * retried by the next one and a repeated run never double-counts.
 */
@Injectable()
export class AnalyticsSyncService {
  private readonly logger = new Logger(AnalyticsSyncService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
  ) {}

  /** Syncs every day before today that still has Redis keys. Returns the days it synced. */
  async syncCompletedDays(now = new Date()): Promise<string[]> {
    const today = dayKeyOf(now);
    const days = (await this.findDayKeys()).filter((day) => day < today).sort();

    for (const day of days) {
      await this.syncDay(day);
      this.logger.log(`Visitor analytics synced for ${day}`);
    }
    return days;
  }

  private async findDayKeys(): Promise<string[]> {
    const days: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        DAY_KEY_PATTERN,
        'COUNT',
        500,
      );
      cursor = next;
      for (const key of keys) {
        const match = DAY_KEY_REGEX.exec(key);
        if (match) days.push(match[1]);
      }
    } while (cursor !== '0');
    return days;
  }

  private async syncDay(day: string): Promise<void> {
    const [audienceHash, userHash, pageViewHash, sessionHash] =
      await Promise.all([
        readHash(this.redis, analyticsKeys.visitors(day)),
        readHash(this.redis, analyticsKeys.users(day)),
        readHash(this.redis, analyticsKeys.pageViews(day)),
        readHash(this.redis, analyticsKeys.sessions(day)),
      ]);

    // A visitor with no session entry had their visit start on an earlier day, so zero sessions
    // today is the true count. Likewise a visitor with no user entry was not signed in today.
    const activity = [...audienceHash].map(([visitorId, audience]) => ({
      day,
      visitorId,
      audience: toAudience(audience),
      userId: userHash.get(visitorId) ?? null,
      sessions: Number(sessionHash.get(visitorId) ?? 0),
      pageViews: Number(pageViewHash.get(visitorId) ?? 0),
    }));

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < activity.length; i += WRITE_BATCH_SIZE) {
        const batch = activity.slice(i, i + WRITE_BATCH_SIZE);

        await tx
          .insert(visitors)
          .values(
            batch.map((row) => ({
              id: row.visitorId,
              userId: row.userId,
              firstSeenOn: day,
              lastSeenOn: day,
            })),
          )
          .onConflictDoUpdate({
            target: visitors.id,
            set: {
              userId: sql`coalesce(excluded.user_id, ${visitors.userId})`,
              firstSeenOn: sql`least(${visitors.firstSeenOn}, excluded.first_seen_on)`,
              lastSeenOn: sql`greatest(${visitors.lastSeenOn}, excluded.last_seen_on)`,
            },
          });

        await tx
          .insert(visitorDailyActivity)
          .values(batch)
          .onConflictDoUpdate({
            target: [visitorDailyActivity.day, visitorDailyActivity.visitorId],
            set: {
              userId: sql`excluded.user_id`,
              audience: sql`excluded.audience`,
              sessions: sql`excluded.sessions`,
              pageViews: sql`excluded.page_views`,
            },
          });
      }

      await tx.execute(sql`
        INSERT INTO daily_visitor_stats
          (day, visitors, signed_in_users, anonymous_visitors, job_seeker_visitors, employer_visitors,
           new_visitors, sessions, page_views, rolling_30d_visitors)
        SELECT
          ${day}::date,
          (SELECT count(*) FROM visitor_daily_activity WHERE day = ${day}::date),
          (SELECT count(*) FROM visitor_daily_activity WHERE day = ${day}::date AND audience <> ${Audience.ANONYMOUS}),
          (SELECT count(*) FROM visitor_daily_activity WHERE day = ${day}::date AND audience = ${Audience.ANONYMOUS}),
          (SELECT count(*) FROM visitor_daily_activity WHERE day = ${day}::date AND audience = ${Audience.JOB_SEEKER}),
          (SELECT count(*) FROM visitor_daily_activity WHERE day = ${day}::date AND audience = ${Audience.EMPLOYER}),
          (SELECT count(*) FROM visitors WHERE first_seen_on = ${day}::date),
          (SELECT coalesce(sum(sessions), 0) FROM visitor_daily_activity WHERE day = ${day}::date),
          (SELECT coalesce(sum(page_views), 0) FROM visitor_daily_activity WHERE day = ${day}::date),
          (SELECT count(DISTINCT visitor_id) FROM visitor_daily_activity
            WHERE day BETWEEN (${day}::date - ${analyticsConfig.rollingWindowDays - 1}) AND ${day}::date)
        ON CONFLICT (day) DO UPDATE SET
          visitors = excluded.visitors,
          signed_in_users = excluded.signed_in_users,
          anonymous_visitors = excluded.anonymous_visitors,
          job_seeker_visitors = excluded.job_seeker_visitors,
          employer_visitors = excluded.employer_visitors,
          new_visitors = excluded.new_visitors,
          sessions = excluded.sessions,
          page_views = excluded.page_views,
          rolling_30d_visitors = excluded.rolling_30d_visitors
      `);
    });

    await this.redis.del(
      analyticsKeys.visitors(day),
      analyticsKeys.users(day),
      analyticsKeys.pageViews(day),
      analyticsKeys.sessions(day),
    );
  }
}
