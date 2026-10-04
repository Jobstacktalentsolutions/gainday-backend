import { IsNotEmpty, IsString, Length } from 'class-validator';

export class AdminVerify2faDto {
  @IsNotEmpty()
  @IsString()
  challengeToken: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
