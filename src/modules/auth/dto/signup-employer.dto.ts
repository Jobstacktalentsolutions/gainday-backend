import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsBoolean,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';

export class SignupEmployerDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;

  @IsBoolean()
  agreedToTerms: boolean;

  /** Where to send the employer after they verify their email, e.g. back to a pack purchase.
   *  Must be a same-site path. The frontend checks it again before using it. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/(?!\/)/, { message: 'redirectPath must be a same-site path' })
  redirectPath?: string;
}
