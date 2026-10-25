import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  /** The signed ID token Google returns to the One Tap / Sign in with Google button. */
  @IsString()
  @IsNotEmpty()
  credential: string;
}
