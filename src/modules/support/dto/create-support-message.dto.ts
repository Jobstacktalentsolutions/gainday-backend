import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSupportMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  topic: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
