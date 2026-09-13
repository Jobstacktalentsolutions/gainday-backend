import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { GRADING_QUEUE } from './grading.constants';
import { GradingService } from './grading.service';

@Processor(GRADING_QUEUE)
@Injectable()
export class GradingProcessor extends WorkerHost {
  private readonly logger = new Logger(GradingProcessor.name);

  constructor(private readonly gradingService: GradingService) {
    super();
  }

  async process(bullJob: BullJob<{ submissionId: string }>): Promise<void> {
    const { submissionId } = bullJob.data;
    this.logger.log(`Processing grading for submission ${submissionId}`);
    await this.gradingService.gradeSubmission(submissionId);
  }
}
