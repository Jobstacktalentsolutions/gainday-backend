import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { JobRole } from '../../../db/schema';

export class SaveDraftJobDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(JobRole, { message: 'Role must be either FINANCE or SALES' })
  role?: JobRole;

  @IsOptional()
  @IsString()
  skillLevel?: string;

  @IsOptional()
  @IsString()
  skillCategory?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsISO8601()
  applicationDeadline?: string;

  @IsOptional()
  @IsBoolean()
  isRemoteFriendly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryFrom?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryTo?: number;

  @IsOptional()
  @IsString()
  companyDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Keep it under 500 characters' })
  description?: string;
}
