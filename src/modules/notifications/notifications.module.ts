import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { CandidateNotificationsService } from './candidate-notifications.service';
import { CandidateNotificationsController } from './candidate-notifications.controller';
import { EmailPreferencesController } from './email-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [CandidateNotificationsController, EmailPreferencesController],
  providers: [
    NotificationsService,
    AdminNotificationsService,
    CandidateNotificationsService,
    NotificationPreferencesService,
  ],
  exports: [
    NotificationsService,
    AdminNotificationsService,
    CandidateNotificationsService,
    NotificationPreferencesService,
  ],
})
export class NotificationsModule {}
