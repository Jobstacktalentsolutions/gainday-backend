import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEmailPreferencesDto {
  @IsOptional()
  @IsBoolean()
  jobRecommendationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  newsletterEnabled?: boolean;
}
