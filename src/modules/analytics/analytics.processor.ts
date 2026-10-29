import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ANALYTICS_QUEUE } from './analytics.constants';
import { AnalyticsSyncService } from './analytics-sync.service';

@Processor(ANALYTICS_QUEUE)
@Injectable()
export class AnalyticsProcessor extends WorkerHost {
  constructor(private readonly sync: AnalyticsSyncService) {
    super();
  }

  async process(): Promise<void> {
    await this.sync.syncCompletedDays();
  }
}
