import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GRADING_QUEUE } from './grading.constants';
import { GradingService } from './grading.service';
import { GradingProcessor } from './grading.processor';
import { AnchorGenerationService } from './anchors/anchor-generation.service';
import { TaskGradingService } from './task-grading.service';
import { AnchorRoleRegistry } from './roles/anchor-role-registry';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: GRADING_QUEUE }),
    UsersModule,
    NotificationsModule,
  ],
  providers: [
    GradingService,
    GradingProcessor,
    AnchorGenerationService,
    TaskGradingService,
    AnchorRoleRegistry,
  ],
  exports: [GradingService],
})
export class GradingModule {}
