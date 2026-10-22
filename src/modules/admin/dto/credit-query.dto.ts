import { IsIn, IsOptional } from 'class-validator';
import { CreditLedgerEntryType } from '../../../db/schema';
import type { AnalyticsTimeframe } from '../analytics-buckets';
import { PaginationQueryDto } from './pagination-query.dto';

export class ListCreditLedgerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(CreditLedgerEntryType))
  type?: CreditLedgerEntryType;
}

export class CreditRevenueQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'year', 'all'])
  timeframe: AnalyticsTimeframe = 'month';
}
