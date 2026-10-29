import { IsIn, IsOptional } from 'class-validator';
import type { AnalyticsTimeframe } from '../analytics-buckets';

export class VisitorAnalyticsQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'year', 'all'])
  timeframe: AnalyticsTimeframe = 'month';
}
