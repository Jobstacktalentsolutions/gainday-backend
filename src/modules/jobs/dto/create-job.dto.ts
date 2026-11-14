import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { IsAfterToday } from './is-after-today.validator';
import { JOB_DESCRIPTION_MAX_LENGTH } from '../job-description.constants';

export class CreateJobDto {
  @IsString()
  @MinLength(3, { message: 'Job title is required' })
  title: string;

  // Free text — a built-in preset (Finance, Sales) or an employer-typed custom role label.
  @IsString()
  @MinLength(1, { message: 'Role is required' })
  role: string;

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
  @IsAfterToday({ message: 'Deadline must be greater than current day' })
  applicationDeadline?: string;

  @IsOptional()
  @IsBoolean()
  isRemoteFriendly?: boolean;

  // null clears a previously saved bound; zero is normalised to null by the service.
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryFrom?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryTo?: number | null;

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
  @MaxLength(JOB_DESCRIPTION_MAX_LENGTH, {
    message: `Keep it under ${JOB_DESCRIPTION_MAX_LENGTH} characters`,
  })
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Keep it under 500 characters' })
  businessProblem?: string;
}
