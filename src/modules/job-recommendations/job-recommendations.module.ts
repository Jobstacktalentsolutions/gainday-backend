import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { JOB_RECOMMENDATIONS_QUEUE } from './job-recommendations.constants';
import { JobMatchEmbeddingService } from './job-match-embedding.service';
import { JobRecommendationsProcessor } from './job-recommendations.processor';
import { JobRecommendationsScheduler } from './job-recommendations.scheduler';
import { JobRecommendationsService } from './job-recommendations.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: JOB_RECOMMENDATIONS_QUEUE }),
    NotificationsModule,
  ],
  providers: [
    JobMatchEmbeddingService,
    JobRecommendationsService,
    JobRecommendationsProcessor,
    JobRecommendationsScheduler,
  ],
})
export class JobRecommendationsModule {}
