import { IsNotEmpty, IsString } from 'class-validator';

export class AdminResend2faDto {
  @IsNotEmpty()
  @IsString()
  challengeToken: string;
}
