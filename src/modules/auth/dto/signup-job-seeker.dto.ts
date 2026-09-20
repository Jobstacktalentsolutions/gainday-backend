import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsBoolean,
} from 'class-validator';

export class SignupJobSeekerDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;

  @IsBoolean()
  agreedToTerms: boolean;
}
