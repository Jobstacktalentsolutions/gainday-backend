import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import type { Request } from 'express';
import { AuthUsersService } from '../../users/auth-users.service';
import { EmployerProfileService } from '../../users/employer-profile.service';
import { JobSeekerProfileService } from '../../users/job-seeker-profile.service';
import { AdminProfileService } from '../../users/admin-profile.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UserRole } from '../../../db/schema';

const extractFromCookie = (req: Request): string | null => {
  return req?.cookies?.access_token || null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: AuthUsersService,
    private readonly employerProfileService: EmployerProfileService,
    private readonly jobSeekerProfileService: JobSeekerProfileService,
    private readonly adminProfileService: AdminProfileService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    } as StrategyOptionsWithoutRequest);
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      return null;
    }

    const profile = await this.findProfileForRole(user.id, user.role);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      profileId: profile?.id,
      fullName: profile?.fullName,
      companyName: (profile as any)?.companyName,
    };
  }

  private async findProfileForRole(userId: string, role: UserRole) {
    switch (role) {
      case UserRole.EMPLOYER:
        return this.employerProfileService.findByUserId(userId);
      case UserRole.JOB_SEEKER:
        return this.jobSeekerProfileService.findByUserId(userId);
      case UserRole.ADMIN:
        return this.adminProfileService.findByUserId(userId);
      default:
        return null;
    }
  }
}
