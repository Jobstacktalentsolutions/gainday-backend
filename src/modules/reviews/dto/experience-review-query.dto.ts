import { IsIn, IsOptional } from 'class-validator';
import type { AnalyticsTimeframe } from '../../admin/analytics-buckets';
import { PaginationQueryDto } from '../../admin/dto/pagination-query.dto';

export class ExperienceReviewSummaryQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'year', 'all'])
  timeframe: AnalyticsTimeframe = 'month';
}

export class ListExperienceReviewsQueryDto extends PaginationQueryDto {}
