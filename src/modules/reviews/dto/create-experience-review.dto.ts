import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateExperienceReviewDto {
  // The completed assessment this rating is about. One rating per submission.
  @IsUUID()
  submissionId: string;

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
