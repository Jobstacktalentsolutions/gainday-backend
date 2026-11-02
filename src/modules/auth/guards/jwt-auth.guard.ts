import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../../../db/schema';
import { ALLOW_UNVERIFIED_EMAIL_KEY } from '../decorators/allow-unverified-email.decorator';

export const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED';

// Admins are created and checked by an admin flow (2FA), so only these two roles must verify.
const VERIFICATION_REQUIRED_ROLES: UserRole[] = [
  UserRole.EMPLOYER,
  UserRole.JOB_SEEKER,
];

/**
 * Authenticates the bearer token, then blocks employers and job seekers whose email is not yet
 * verified. Routes marked @AllowUnverifiedEmail() are the only exceptions.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) {
      return false;
    }

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_EMAIL_KEY,
      [context.getHandler(), context.getClass()],
    );
    const { user } = context.switchToHttp().getRequest();

    if (
      !allowUnverified &&
      VERIFICATION_REQUIRED_ROLES.includes(user.role) &&
      !user.isEmailVerified
    ) {
      throw new ForbiddenException({
        code: EMAIL_NOT_VERIFIED_CODE,
        message: 'Verify your email address to continue.',
      });
    }
    return true;
  }
}
