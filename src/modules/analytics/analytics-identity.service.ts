import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../db/schema';

export interface TrackedUser {
  userId: string;
  role: UserRole;
}

/**
 * Reads the signed-in user from a Bearer token without a database lookup, since tracking runs on
 * every page view. Any problem with the token means the visitor is treated as anonymous.
 */
@Injectable()
export class AnalyticsIdentityService {
  constructor(private readonly jwt: JwtService) {}

  resolve(authorization: string | undefined): TrackedUser | null {
    if (!authorization?.startsWith('Bearer ')) return null;

    try {
      const payload = this.jwt.verify<{ sub: string; role: UserRole }>(
        authorization.slice('Bearer '.length),
      );
      return { userId: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }
}
