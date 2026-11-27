import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import {
  generationReviewItems,
  GenerationReviewStatus,
} from '../../db/schema/generation-review.schema';
import { generationConfig } from '../../config/ai.config';
import type { DrizzleDb } from '../../db/client';
import {
  jobs,
  simulations,
  DEFAULT_SIMULATION_TIME_LIMIT_MINUTES,
  AdminNotificationSeverity,
  JobStatus,
} from '../../db/schema';
import { GENERATION_QUEUE } from './generation.constants';
import { GenerationService } from './generation.service';
import { JobBoardCacheService } from '../jobs/job-board/job-board-cache.service';
import { AdminNotificationsService } from '../notifications/admin-notifications.service';

@Processor(GENERATION_QUEUE)
@Injectable()
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly generationService: GenerationService,
    private readonly jobBoardCache: JobBoardCacheService,
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {
    super();
  }

  async process(bullJob: BullJob<{ jobId: string }>): Promise<any> {
    const { jobId } = bullJob.data;
    this.logger.log(`Processing simulation generation for Job ID: ${jobId}`);

    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await this.db
      .update(jobs)
      .set({ status: 'GENERATING', updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    try {
      // A new run replaces the simulation, so review items from the previous run no longer point at
      // a saved task. They are closed here so the new run's slots are reviewed on their own.
      await this.db
        .update(generationReviewItems)
        .set({
          status: GenerationReviewStatus.REJECTED,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(generationReviewItems.jobId, jobId),
            eq(generationReviewItems.status, GenerationReviewStatus.PENDING),
          ),
        );

      const result = await this.generationService.runGeneration(
        job,
        (progress) => bullJob.updateProgress(progress),
      );

      await this.db
        .insert(simulations)
        .values({
          jobId,
          tasks: result.finalizedTasks,
          // Flat for now (see DEFAULT_SIMULATION_TIME_LIMIT_MINUTES) — not derived from task
          // count. Set explicitly here rather than left to the column default so a "regenerate
          // all" re-run (the onConflictDoUpdate below) doesn't need to touch it either way: it's
          // only ever written once, on first insert.
          timeLimitMinutes: DEFAULT_SIMULATION_TIME_LIMIT_MINUTES,
        })
        .onConflictDoUpdate({
          target: simulations.jobId,
          set: { tasks: result.finalizedTasks, updatedAt: new Date() },
        });

      // Tasks are retained in the simulation draft even when flagged for AI oversight.
      const hasIncompleteSlots =
        result.finalizedTasks.length < generationConfig.selectedTaskCount;

      // Generated tasks remain a draft until the employer publishes the job.
      await this.db
        .update(jobs)
        .set({ status: JobStatus.DRAFT, updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
      await this.jobBoardCache.invalidateAll();

      this.logger.log(
        `Generation complete for Job ID ${jobId}: ${result.finalizedTasks.length} tasks, ${result.adminReviewItemsPersisted} sent to admin review.` +
          (hasIncompleteSlots
            ? ` Simulation incomplete: ${result.finalizedTasks.length} of ${generationConfig.selectedTaskCount} tasks saved. Retry generation to rebuild it.`
            : ''),
      );

      return result;
    } catch (err) {
      this.logger.error(`Generation failed for Job ID ${jobId}:`, err);
      await this.db
        .update(jobs)
        .set({ status: 'GENERATION_FAILED', updatedAt: new Date() })
        .where(eq(jobs.id, jobId));

      try {
        await this.adminNotificationsService.create({
          severity: AdminNotificationSeverity.CRITICAL,
          type: 'GENERATION_FAILED',
          title: 'Simulation generation failed',
          message: `Simulation generation failed for job "${job?.title ?? jobId}": ${(err as Error)?.message ?? 'Unknown error'}`,
          details: (err as Error)?.stack ?? String(err),
          metadata: { jobId },
        });
      } catch (notifyErr) {
        this.logger.error(
          `Failed to record admin notification for generation failure on Job ID ${jobId}:`,
          notifyErr,
        );
      }

      throw err;
    }
  }
}
