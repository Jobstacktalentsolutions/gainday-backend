import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { IsAfterToday } from './is-after-today.validator';
import { JOB_DESCRIPTION_MAX_LENGTH } from '../job-description.constants';

export class SaveDraftJobDto {
  @IsOptional()
  @IsString()
  title?: string;

  // Free text — a built-in preset (Finance, Sales) or an employer-typed custom role label.
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  skillLevel?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(JOB_DESCRIPTION_MAX_LENGTH, {
    message: `Keep it under ${JOB_DESCRIPTION_MAX_LENGTH} characters`,
  })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Keep it under 500 characters' })
  businessProblem?: string;
}
