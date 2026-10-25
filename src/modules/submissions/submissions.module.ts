import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { StagedChatController } from './staged-chat/staged-chat.controller';
import { StagedChatService } from './staged-chat/staged-chat.service';
import { BRANCH_EVALUATOR, NoBranchEvaluator } from './staged-chat/branch-evaluator';
import { SubmissionsController } from './submissions.controller';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { GradingModule } from '../grading/grading.module';
import { CreditsModule } from '../credits/credits.module';
import { CapabilityPassportModule } from '../capability-passport/capability-passport.module';
import { GenerationModule } from '../generation/generation.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    JobsModule,
    GradingModule,
    CreditsModule,
    CapabilityPassportModule,
    GenerationModule,
    NotificationsModule,
  ],
  controllers: [SubmissionsController, StagedChatController],
  providers: [
    SubmissionsService,
    StagedChatService,
    { provide: BRANCH_EVALUATOR, useClass: NoBranchEvaluator },
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
