import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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

  @IsOptional()
  @IsString()
  @MaxLength(50)
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
}
