import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUsersService } from '../users/auth-users.service';
import { UserRole } from '../../db/schema';
import { AuthService } from './auth.service';
import { GoogleTokenVerifier } from './google-token-verifier.service';

/**
 * Signs an existing user in with a Google ID token. Login only: a Google email with no Gainday
 * account is refused, never signed up, so each account is still created by its own signup flow.
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly verifier: GoogleTokenVerifier,
    private readonly usersService: AuthUsersService,
    private readonly authService: AuthService,
  ) {}

  async signIn(credential: string) {
    const identity = await this.verifier.verify(credential);
    if (!identity.emailVerified) {
      throw new UnauthorizedException('This Google email is not verified.');
    }

    const user = await this.usersService.findByEmailWithPassword(identity.email);
    if (!user) {
      throw new UnauthorizedException(
        'No Gainday account uses this Google email. Sign up first.',
      );
    }
    // Admin login enforces an emailed 2FA code, which Google sign-in would skip.
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Administrators must sign in from the admin login page.',
      );
    }
    this.authService.assertAccountActive(user);

    if (user.googleId !== null && user.googleId !== identity.googleId) {
      throw new UnauthorizedException(
        'This account is linked to a different Google account.',
      );
    }
    if (user.googleId === null || !user.isEmailVerified) {
      await this.usersService.linkGoogleAccount(user.id, identity.googleId);
    }

    const result = await this.authService.login(user);
    return { ...result, isEmailVerified: true };
  }
}
