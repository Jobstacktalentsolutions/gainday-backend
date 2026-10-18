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

export interface GradingJobData {
  submissionId: string;
  /** How many times this submission's job has been queued again after stalling. */
  stallRecoveries?: number;
}

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

  async process(bullJob: BullJob<GradingJobData>): Promise<void> {
    if (bullJob.name === SWEEP_STUCK_GRADING_JOB) {
      await this.sweeperService.sweep();
      return;
    }

    const { submissionId } = bullJob.data;
    this.logger.log(`Processing grading for submission ${submissionId}`);
    await this.gradingService.gradeSubmission(submissionId);
  }

  /** Fires after every failed attempt, and when BullMQ gives up on a stalled job. Two cases end
   *  the job: every attempt was used (GRADING_FAILED, with the reason sent to admins), or a stall
   *  — the worker died mid-grading — which is recovered rather than reported. */
  @OnWorkerEvent('failed')
  async onFailed(
    bullJob: BullJob<GradingJobData> | undefined,
    err: Error,
  ): Promise<void> {
    if (!bullJob || bullJob.name !== GRADE_SUBMISSION_JOB) return;
    const { submissionId, stallRecoveries = 0 } = bullJob.data;

    if (bullJob.attemptsMade >= (bullJob.opts.attempts ?? 1)) {
      await this.gradingService.markGradingFailed(
        submissionId,
        `all ${bullJob.attemptsMade} attempts failed — last error: ${err.message}`,
      );
      return;
    }

    // Attempts remain. An ordinary failure has already been scheduled for retry (the job is
    // 'delayed'). A job that is simply 'failed' was dropped without one: it stalled.
    if ((await bullJob.getState()) !== 'failed') return;
    await this.gradingService.recoverStalledGrading(
      submissionId,
      stallRecoveries,
    );
  }
}
