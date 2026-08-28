import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { jobs, simulations } from '../../db/schema';
import { GENERATION_QUEUE } from './generation.constants';
import { GenerationService } from './generation.service';

@Processor(GENERATION_QUEUE)
@Injectable()
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly generationService: GenerationService,
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
      const result = await this.generationService.runGeneration(job);

      await this.db
        .insert(simulations)
        .values({
          jobId,
          tasks: result.finalizedTasks,
        })
        .onConflictDoUpdate({
          target: simulations.jobId,
          set: { tasks: result.finalizedTasks, updatedAt: new Date() },
        });

      const hasIncompleteSlots = result.adminReviewItemsPersisted > 0;

      await this.db
        .update(jobs)
        .set({
          status: hasIncompleteSlots ? 'UNDER_REVIEW' : 'ACTIVE',
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      this.logger.log(
        `Generation complete for Job ID ${jobId}: ${result.finalizedTasks.length} tasks, ${result.adminReviewItemsPersisted} sent to admin review.` +
          (hasIncompleteSlots
            ? ' Job held at UNDER_REVIEW pending admin resolution.'
            : ''),
      );

      return result;
    } catch (err) {
      this.logger.error(`Generation failed for Job ID ${jobId}:`, err);
      await this.db
        .update(jobs)
        .set({ status: 'GENERATION_FAILED', updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
      throw err;
    }
  }
}
