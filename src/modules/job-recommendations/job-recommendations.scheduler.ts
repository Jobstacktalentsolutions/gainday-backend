import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  JOB_RECOMMENDATIONS_QUEUE,
  RUN_JOB_RECOMMENDATIONS_JOB,
  jobRecommendationConfig,
} from './job-recommendations.constants';

/** Registers the recurring pass as a BullMQ job scheduler, so one schedule applies across all app
 *  instances and survives restarts. */
@Injectable()
export class JobRecommendationsScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(JOB_RECOMMENDATIONS_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      RUN_JOB_RECOMMENDATIONS_JOB,
      {
        pattern: jobRecommendationConfig.cronPattern,
        tz: jobRecommendationConfig.timezone,
      },
      {
        name: RUN_JOB_RECOMMENDATIONS_JOB,
        // A failed pass is recorded in job_recommendation_runs and its jobs are picked up by the
        // next scheduled pass, so BullMQ retries and failure history are not needed.
        opts: { attempts: 1, removeOnComplete: true, removeOnFail: true },
      },
    );
  }
}
