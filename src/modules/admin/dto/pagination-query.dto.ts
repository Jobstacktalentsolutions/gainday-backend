import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../../db/schema';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  role?: (typeof UserRole)[keyof typeof UserRole];

  @IsOptional()
  @IsString()
  status?: string;
}

export class ListJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class ListGenerationReviewsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}
