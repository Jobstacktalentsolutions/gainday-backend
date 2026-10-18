import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminNotificationsService } from '../notifications/admin-notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../db/schema';
import { ListAdminNotificationsQueryDto } from './dto/notification-query.dto';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminNotificationsController {
  constructor(
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {}

  @Get()
  list(@Query() query: ListAdminNotificationsQueryDto) {
    return this.adminNotificationsService.list(query);
  }

  // Static routes are declared before `:id/read` so they are never matched as an id.
  @Get('stats')
  getStats() {
    return this.adminNotificationsService.getStats();
  }

  @Put('read-all')
  markAllRead() {
    return this.adminNotificationsService.markAllRead();
  }

  @Put(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminNotificationsService.markRead(id);
  }
}
