import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GRADING_BACKOFF_TYPE, GRADING_QUEUE } from './grading.constants';
import { GradingService } from './grading.service';
import { GradingProcessor } from './grading.processor';
import { GradingSweeperService } from './grading-sweeper.service';
import { gradingConfig } from '../../config/ai.config';
import { AnchorGenerationService } from './anchors/anchor-generation.service';
import { TaskGradingService } from './task-grading.service';
import { AnchorRoleRegistry } from './roles/anchor-role-registry';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GenerationModule } from '../generation/generation.module';

@Module({
  imports: [
    GenerationModule,
    BullModule.registerQueue({
      name: GRADING_QUEUE,
      defaultJobOptions: {
        attempts: gradingConfig.maxJobAttempts,
        // Delay is computed by gradingBackoffStrategy (registered on the worker in
        // GradingProcessor) so rate-limit failures can back off longer than ordinary ones.
        backoff: { type: GRADING_BACKOFF_TYPE },
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
    UsersModule,
    NotificationsModule,
  ],
  providers: [
    GradingService,
    GradingProcessor,
    GradingSweeperService,
    AnchorGenerationService,
    TaskGradingService,
    AnchorRoleRegistry,
  ],
  exports: [GradingService],
})
export class GradingModule {}
