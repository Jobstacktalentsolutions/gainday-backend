import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  jobs,
  simulations,
  DEFAULT_SIMULATION_TIME_LIMIT_MINUTES,
  AdminNotificationSeverity,
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

      const hasIncompleteSlots = result.adminReviewItemsPersisted > 0;

      // A job with task slots awaiting admin review stays a draft until they are resolved, so it
      // never goes live with missing tasks.
      await this.db
        .update(jobs)
        .set(
          hasIncompleteSlots
            ? { status: 'DRAFT', updatedAt: new Date() }
            : {
                status: 'ACTIVE',
                activatedAt: new Date(),
                updatedAt: new Date(),
              },
        )
        .where(eq(jobs.id, jobId));
      await this.jobBoardCache.invalidateAll();

      this.logger.log(
        `Generation complete for Job ID ${jobId}: ${result.finalizedTasks.length} tasks, ${result.adminReviewItemsPersisted} sent to admin review.` +
          (hasIncompleteSlots
            ? ' Some generation slots sent to admin review pending resolution.'
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
