import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { ANALYTICS_QUEUE } from './analytics.constants';
import { AnalyticsProcessor } from './analytics.processor';
import { AnalyticsScheduler } from './analytics.scheduler';
import { AnalyticsIdentityService } from './analytics-identity.service';
import { AnalyticsReportService } from './analytics-report.service';
import { AnalyticsSyncService } from './analytics-sync.service';
import { AnalyticsTrackingController } from './analytics-tracking.controller';
import { AnalyticsTrackingService } from './analytics-tracking.service';

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: ANALYTICS_QUEUE })],
  controllers: [AnalyticsTrackingController],
  providers: [
    AnalyticsIdentityService,
    AnalyticsTrackingService,
    AnalyticsSyncService,
    AnalyticsReportService,
    AnalyticsScheduler,
    AnalyticsProcessor,
  ],
  exports: [AnalyticsReportService],
})
export class AnalyticsModule {}
