import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateEmailPreferencesDto } from './dto/update-email-preferences.dto';

/**
 * Public, not signed-in: reached from the unsubscribe link in an email. The token in the path is
 * the only credential, so there are no auth guards here.
 */
@Controller('email-preferences')
export class EmailPreferencesController {
  constructor(private readonly preferences: NotificationPreferencesService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.preferences.findByToken(token);
  }

  @Patch(':token')
  update(
    @Param('token') token: string,
    @Body() dto: UpdateEmailPreferencesDto,
  ) {
    return this.preferences.updateByToken(token, dto);
  }
}
