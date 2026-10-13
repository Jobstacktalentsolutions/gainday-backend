import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UnlockCandidatesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  submissionIds: string[];
}
