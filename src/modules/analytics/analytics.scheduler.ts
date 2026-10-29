import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { analyticsConfig } from '../../config/analytics.config';
import {
  ANALYTICS_QUEUE,
  SYNC_VISITOR_ANALYTICS_JOB,
} from './analytics.constants';

/** Registers the end-of-day sync as a BullMQ job scheduler, so one schedule applies across instances. */
@Injectable()
export class AnalyticsScheduler implements OnModuleInit {
  constructor(@InjectQueue(ANALYTICS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      SYNC_VISITOR_ANALYTICS_JOB,
      {
        pattern: analyticsConfig.cronPattern,
        tz: analyticsConfig.timezone,
      },
      {
        name: SYNC_VISITOR_ANALYTICS_JOB,
        // A failed sync leaves its Redis keys in place, so the next run picks the day up.
        opts: { attempts: 1, removeOnComplete: true, removeOnFail: true },
      },
    );
  }
}
