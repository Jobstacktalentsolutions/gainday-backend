import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import {
  GRADE_SUBMISSION_JOB,
  GRADING_QUEUE,
  SWEEP_STUCK_GRADING_JOB,
} from './grading.constants';
import { GradingService } from './grading.service';
import { GradingSweeperService } from './grading-sweeper.service';
import { gradingBackoffStrategy } from './utils/grading-backoff';

@Processor(GRADING_QUEUE, {
  settings: { backoffStrategy: gradingBackoffStrategy },
})
@Injectable()
export class GradingProcessor extends WorkerHost {
  private readonly logger = new Logger(GradingProcessor.name);

  constructor(
    private readonly gradingService: GradingService,
    private readonly sweeperService: GradingSweeperService,
  ) {
    super();
  }

  async process(bullJob: BullJob<{ submissionId: string }>): Promise<void> {
    if (bullJob.name === SWEEP_STUCK_GRADING_JOB) {
      await this.sweeperService.sweep();
      return;
    }

    const { submissionId } = bullJob.data;
    this.logger.log(`Processing grading for submission ${submissionId}`);
    await this.gradingService.gradeSubmission(submissionId);
  }

  /** Fires after every failed attempt; only the last one is terminal. */
  @OnWorkerEvent('failed')
  async onFailed(
    bullJob: BullJob<{ submissionId: string }> | undefined,
    err: Error,
  ): Promise<void> {
    if (!bullJob || bullJob.name !== GRADE_SUBMISSION_JOB) return;
    if (bullJob.attemptsMade < (bullJob.opts.attempts ?? 1)) return;

    await this.gradingService.markGradingFailed(
      bullJob.data.submissionId,
      `all ${bullJob.attemptsMade} attempts failed — last error: ${err.message}`,
    );
  }
}
