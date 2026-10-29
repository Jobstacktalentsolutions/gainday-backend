import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { analyticsConfig } from '../../config/analytics.config';
import { Audience } from '../../db/schema';
import { REDIS } from '../redis/redis.constants';
import { analyticsKeys } from './analytics.constants';
import { dayKeyOf } from './analytics-day';

export interface PageView {
  visitorId: string;
  audience: Audience;
  /** Set only for a signed-in visitor. */
  userId: string | null;
  now?: Date;
}

/**
 * Records page views in Redis only; Postgres is updated once a day by the sync. Errors are logged
 * and swallowed, so tracking can never break a page.
 */
@Injectable()
export class AnalyticsTrackingService {
  private readonly logger = new Logger(AnalyticsTrackingService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * Counts this ping against the visitor's minute window. Fails open: if Redis is unavailable the
   * ping is allowed, since refusing it would drop real visits.
   */
  async allowPing(visitorId: string, now: Date): Promise<boolean> {
    try {
      const minute = Math.floor(now.getTime() / 60_000);
      const key = analyticsKeys.pingRate(visitorId, minute);
      const count = await this.redis.incr(key);
      await this.redis.expire(key, 120);
      return count <= analyticsConfig.maxPingsPerMinute;
    } catch (err) {
      this.logger.warn(
        `Visitor ping rate check failed: ${(err as Error).message}`,
      );
      return true;
    }
  }

  async recordPageView(view: PageView): Promise<void> {
    try {
      const day = dayKeyOf(view.now ?? new Date());
      const keys = [
        analyticsKeys.visitors(day),
        analyticsKeys.pageViews(day),
        analyticsKeys.sessions(day),
        analyticsKeys.users(day),
      ];

      // SET NX succeeds only when no visit is active, so this is the first page of a new session.
      const sessionStarted = await this.redis.set(
        analyticsKeys.session(view.visitorId),
        '1',
        'EX',
        analyticsConfig.sessionTtlSeconds,
        'NX',
      );

      const pipeline = this.redis.pipeline();
      // A signed-in audience replaces the anonymous marker; an anonymous ping never overwrites it.
      if (view.audience === Audience.ANONYMOUS) {
        pipeline.hsetnx(keys[0], view.visitorId, view.audience);
      } else {
        pipeline.hset(keys[0], view.visitorId, view.audience);
      }
      if (view.userId) {
        pipeline.hset(keys[3], view.visitorId, view.userId);
      }
      pipeline.hincrby(keys[1], view.visitorId, 1);
      if (sessionStarted === 'OK') {
        pipeline.hincrby(keys[2], view.visitorId, 1);
      }
      for (const key of keys) {
        pipeline.expire(key, analyticsConfig.dayKeyTtlSeconds);
      }
      await pipeline.exec();
    } catch (err) {
      this.logger.warn(
        `Visitor tracking write failed: ${(err as Error).message}`,
      );
    }
  }
}
