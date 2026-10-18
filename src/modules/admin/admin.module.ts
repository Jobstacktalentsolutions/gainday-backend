import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AuthModule } from '../auth/auth.module';
import { GenerationModule } from '../generation/generation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [AuthModule, GenerationModule, NotificationsModule, CreditsModule],
  controllers: [AdminController, AdminNotificationsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
