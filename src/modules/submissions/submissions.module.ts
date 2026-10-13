import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { GradingModule } from '../grading/grading.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [AuthModule, JobsModule, GradingModule, CreditsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
