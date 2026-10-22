import {
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Gender, Pronouns } from '../../../db/schema';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  // International E.164 (e.g. +447911123456), as produced by the frontend country picker.
  // An empty string clears the number and skips validation.
  @ValidateIf((dto: UpdateProfileDto) => !!dto.phoneNumber)
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'phoneNumber must be an E.164 number' })
  @IsPhoneNumber()
  phoneNumber?: string;

  // Candidate-only fields. `null` clears gender (it's optional); pronouns can't be cleared once
  // set, since they're required to apply.
  @IsOptional()
  @IsIn(Object.values(Gender))
  gender?: Gender | null;

  @IsOptional()
  @IsIn(Object.values(Pronouns))
  pronouns?: Pronouns;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  brief?: string;

  // The role the candidate is looking for. Drives job recommendations; an empty string clears it.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
