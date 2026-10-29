import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../db/schema';
import { ReviewsService } from './reviews.service';
import {
  ExperienceReviewSummaryQueryDto,
  ListExperienceReviewsQueryDto,
} from './dto/experience-review-query.dto';

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Static route is declared before the list route so it is never matched as a page query.
  @Get('summary')
  getSummary(@Query() query: ExperienceReviewSummaryQueryDto) {
    return this.reviewsService.getSummary(query.timeframe);
  }

  @Get()
  list(@Query() query: ListExperienceReviewsQueryDto) {
    return this.reviewsService.listReviews(query);
  }
}
