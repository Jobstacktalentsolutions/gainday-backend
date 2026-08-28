import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringProcessor } from './scoring.processor';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UsersModule, NotificationsModule],
  providers: [ScoringService, ScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
