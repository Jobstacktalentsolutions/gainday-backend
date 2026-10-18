import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { CandidateNotificationsService } from './candidate-notifications.service';
import { CandidateNotificationsController } from './candidate-notifications.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [CandidateNotificationsController],
  providers: [
    NotificationsService,
    AdminNotificationsService,
    CandidateNotificationsService,
  ],
  exports: [
    NotificationsService,
    AdminNotificationsService,
    CandidateNotificationsService,
  ],
})
export class NotificationsModule {}
