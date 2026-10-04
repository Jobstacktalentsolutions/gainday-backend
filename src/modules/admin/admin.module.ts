import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { GenerationModule } from '../generation/generation.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, GenerationModule, NotificationsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
