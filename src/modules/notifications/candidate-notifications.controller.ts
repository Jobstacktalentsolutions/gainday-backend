import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CandidateNotificationsService } from './candidate-notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';

@Controller('candidate/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER)
export class CandidateNotificationsController {
  constructor(
    private readonly candidateNotificationsService: CandidateNotificationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.candidateNotificationsService.list(user.profileId);
  }

  // Static routes are declared before `:id/read` so they are never matched as an id.
  @Get('unread-status')
  getUnreadStatus(@CurrentUser() user: any) {
    return this.candidateNotificationsService.hasUnread(user.profileId);
  }

  @Put('read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.candidateNotificationsService.markAllRead(user.profileId);
  }

  @Put(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.candidateNotificationsService.markRead(id, user.profileId);
  }
}
