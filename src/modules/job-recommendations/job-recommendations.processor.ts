import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { JOB_RECOMMENDATIONS_QUEUE } from './job-recommendations.constants';
import { JobRecommendationsService } from './job-recommendations.service';

@Processor(JOB_RECOMMENDATIONS_QUEUE)
@Injectable()
export class JobRecommendationsProcessor extends WorkerHost {
  constructor(private readonly recommendations: JobRecommendationsService) {
    super();
  }

  async process(): Promise<void> {
    await this.recommendations.runPass();
  }
}
