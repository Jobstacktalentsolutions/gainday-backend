import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateExperienceReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  // Asked for on low ratings only, so it is optional.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
