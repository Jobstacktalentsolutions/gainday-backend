import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';
import { ReviewsService } from './reviews.service';
import { CreateExperienceReviewDto } from './dto/create-experience-review.dto';

// Candidates and employers both rate their experience. Admins have their own endpoints.
@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JOB_SEEKER, UserRole.EMPLOYER)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('me')
  findMine(@CurrentUser() user: { id: string }) {
    return this.reviewsService.findMine(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateExperienceReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }
}
