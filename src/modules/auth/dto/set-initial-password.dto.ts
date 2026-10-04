import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class SetInitialPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'Please confirm your new password' })
  confirmNewPassword: string;
}
