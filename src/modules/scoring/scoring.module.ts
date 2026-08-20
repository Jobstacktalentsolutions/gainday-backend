import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoringService } from './scoring.service';
import { ScoringProcessor } from './scoring.processor';
import { Submission } from '../submissions/entities/submission.entity';
import { Job } from '../jobs/entities/job.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, Job]),
    UsersModule,
    NotificationsModule,
  ],
  providers: [ScoringService, ScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
