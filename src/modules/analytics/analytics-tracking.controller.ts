import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Audience, UserRole } from '../../db/schema';
import {
  AnalyticsIdentityService,
  TrackedUser,
} from './analytics-identity.service';
import { AnalyticsTrackingService } from './analytics-tracking.service';
import { AnalyticsPingDto } from './dto/analytics-ping.dto';
import { isBot } from './bot-filter';

/** Anonymous visitors are ANONYMOUS; a signed-in visitor takes the audience of their role. */
function audienceOf(user: TrackedUser | null): Audience {
  if (user === null) return Audience.ANONYMOUS;
  return user.role === UserRole.EMPLOYER
    ? Audience.EMPLOYER
    : Audience.JOB_SEEKER;
}

/** Public on purpose: anonymous visitors are tracked too. A signed-in user is read from the token. */
@Controller('analytics')
export class AnalyticsTrackingController {
  constructor(
    private readonly identity: AnalyticsIdentityService,
    private readonly tracking: AnalyticsTrackingService,
  ) {}

  @Post('ping')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ping(
    @Body() body: AnalyticsPingDto,
    @Headers('authorization') authorization: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<void> {
    if (isBot(userAgent)) return;

    const user = this.identity.resolve(authorization);
    if (user?.role === UserRole.ADMIN) return;

    if (!(await this.tracking.allowPing(body.visitorId, new Date()))) {
      throw new HttpException(
        'Too many page views',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.tracking.recordPageView({
      visitorId: body.visitorId,
      audience: audienceOf(user),
      userId: user?.userId ?? null,
    });
  }
}
