import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { JobRole } from '../../../db/schema';

export class CreateJobDto {
  @IsString()
  @MinLength(3, { message: 'Job title is required' })
  title: string;

  @IsEnum(JobRole, { message: 'Role must be either FINANCE or SALES' })
  role: JobRole;

  @IsString()
  @MinLength(1, { message: 'Skill level is required' })
  skillLevel: string;

  @IsOptional()
  @IsString()
  skillCategory?: string;

  @IsString()
  @MinLength(1, { message: 'Location is required' })
  location: string;

  @IsString()
  @MinLength(1, { message: 'Employment type is required' })
  employmentType: string;

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

  @IsString()
  @MinLength(40, {
    message: 'Give at least 40 characters so Gainday has enough to work with',
  })
  @MaxLength(500, { message: 'Keep it under 500 characters' })
  description: string;
}
