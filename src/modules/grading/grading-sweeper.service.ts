import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, inArray, isNotNull, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { submissions } from '../../db/schema';
import { gradingConfig } from '../../config/ai.config';
import { GradingService } from './grading.service';
import { GRADING_QUEUE, SWEEP_STUCK_GRADING_JOB } from './grading.constants';

/**
 * Safety net for submissions that fall out of the grading queue: a lost Redis job, a worker that
 * was down when the job was enqueued, or a job whose retries were exhausted without anyone
 * noticing. Runs on a BullMQ job scheduler (one schedule across all app instances) and re-queues
 * any submitted PENDING/GRADING submission that has been untouched for `stuckThresholdMs` and has
 * no live queue job. Submissions that fail all their retries end in GRADING_FAILED, which this
 * never picks up, so a permanently failing submission cannot be re-queued forever.
 */
@Injectable()
export class GradingSweeperService implements OnModuleInit {
  private readonly logger = new Logger(GradingSweeperService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @InjectQueue(GRADING_QUEUE) private readonly gradingQueue: Queue,
    private readonly gradingService: GradingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.gradingQueue.upsertJobScheduler(
      SWEEP_STUCK_GRADING_JOB,
      { every: gradingConfig.sweepIntervalMs },
      {
        name: SWEEP_STUCK_GRADING_JOB,
        // The default grading job options keep every job forever and retry 10 times; the sweep
        // is neither something to retry nor something to keep a record of.
        opts: { attempts: 1, removeOnComplete: true, removeOnFail: true },
      },
    );
  }

  async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - gradingConfig.stuckThresholdMs);
    // A run that was started but never submitted is also PENDING, but has no completedAt.
    const stuck = await this.db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          inArray(submissions.status, ['PENDING', 'GRADING']),
          isNotNull(submissions.completedAt),
          lt(submissions.updatedAt, cutoff),
        ),
      );

    let requeued = 0;
    for (const { id } of stuck) {
      // Skips a submission whose job will still run, and clears a finished or failed one first.
      if (await this.gradingService.queueGrading(id)) requeued++;
    }

    if (stuck.length > 0) {
      this.logger.warn(
        `Sweep found ${stuck.length} stuck submission(s) older than ${gradingConfig.stuckThresholdMs / 60_000} min; re-queued ${requeued}`,
      );
    }
  }
}
