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
  @MaxLength(5000, { message: 'Keep it under 5000 characters' })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Keep it under 500 characters' })
  businessProblem?: string;
}
