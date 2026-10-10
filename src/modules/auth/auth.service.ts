import {
  Inject,
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUsersService } from '../users/auth-users.service';
import { EmployerProfileService } from '../users/employer-profile.service';
import { JobSeekerProfileService } from '../users/job-seeker-profile.service';
import { AdminProfileService } from '../users/admin-profile.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole, AuthProvider, users } from '../../db/schema';
import { SignupEmployerDto } from './dto/signup-employer.dto';
import { SignupJobSeekerDto } from './dto/signup-job-seeker.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_VERIFICATION_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly usersService: AuthUsersService,
    private readonly employerProfileService: EmployerProfileService,
    private readonly jobSeekerProfileService: JobSeekerProfileService,
    private readonly adminProfileService: AdminProfileService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      return null;
    }

    if (!user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      const { password, ...result } = user;
      return result;
    }

    return null;
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

  async login(user: any) {
    const profile = await this.findProfileForRole(user.id, user.role);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      profileId: profile?.id,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profileId: profile?.id,
        fullName: profile?.fullName,
        companyName: (profile as any)?.companyName,
      },
    };
  }

  async registerEmployer(dto: SignupEmployerDto) {
    const { email, password, fullName, companyName, agreedToTerms } = dto;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    if (!agreedToTerms) {
      throw new BadRequestException('Must agree to terms to continue');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MS,
    );

    const user = await this.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          role: UserRole.EMPLOYER,
          authProvider: AuthProvider.LOCAL,
          emailVerificationToken,
          emailVerificationExpires,
        })
        .returning();

      await this.employerProfileService.create(
        {
          userId: newUser.id,
          fullName,
          companyName,
        },
        tx,
      );

      return newUser;
    });

    await this.notificationsService.sendVerificationEmail(
      email,
      emailVerificationToken,
      UserRole.EMPLOYER,
    );

    return this.login(user);
  }

  async registerJobSeeker(dto: SignupJobSeekerDto) {
    const { email, password, fullName, agreedToTerms } = dto;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    if (!agreedToTerms) {
      throw new BadRequestException('Must agree to terms to continue');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MS,
    );

    const user = await this.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          role: UserRole.JOB_SEEKER,
          authProvider: AuthProvider.LOCAL,
          emailVerificationToken,
          emailVerificationExpires,
        })
        .returning();

      await this.jobSeekerProfileService.create(
        {
          userId: newUser.id,
          fullName,
        },
        tx,
      );

      return newUser;
    });

    await this.notificationsService.sendVerificationEmail(
      email,
      emailVerificationToken,
      UserRole.JOB_SEEKER,
    );

    return this.login(user);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await this.usersService.setPasswordResetToken(
      user.id,
      resetToken,
      resetExpires,
    );
    await this.notificationsService.sendPasswordResetEmail(
      email,
      resetToken,
      user.role,
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const { password, confirmPassword, token } = dto;

    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.usersService.findByValidPasswordResetToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
  }

  /** Authenticated in-session password change — distinct from resetPassword's emailed-token
   *  flow, since this requires proving the CURRENT password rather than owning the account's
   *  inbox. Google-only accounts (no local password set) get a clear error rather than a
   *  bcrypt.compare crash against a null hash. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword, confirmNewPassword } = dto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'This account signs in with Google and has no password to change',
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
  }

  async verifyEmail(token: string): Promise<boolean> {
    const result = await this.usersService.verifyEmailByToken(token);
    return !!result;
  }

  /**
   * Silently no-ops for unknown or already-verified emails (so the endpoint
   * can't be used to probe accounts) and inside the resend cooldown.
   * A still-valid token is reused so links from earlier emails keep working.
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.usersService.findVerificationStateByEmail(email);
    if (!user || user.isEmailVerified) {
      return;
    }

    const now = Date.now();
    const { emailVerificationToken, emailVerificationExpires } = user;
    const liveToken =
      emailVerificationToken &&
      emailVerificationExpires &&
      emailVerificationExpires.getTime() > now
        ? emailVerificationToken
        : null;

    if (liveToken && emailVerificationExpires) {
      // Issue time is derived from the expiry, which is refreshed on each send.
      const issuedAt = emailVerificationExpires.getTime() - EMAIL_VERIFICATION_TTL_MS;
      if (now - issuedAt < RESEND_VERIFICATION_COOLDOWN_MS) {
        return;
      }
    }

    const token = liveToken ?? crypto.randomBytes(32).toString('hex');
    await this.usersService.updateVerificationToken(
      user.id,
      token,
      new Date(now + EMAIL_VERIFICATION_TTL_MS),
    );
    await this.notificationsService.sendVerificationEmail(
      email,
      token,
      user.role,
    );
  }

  async validateGoogleUser(
    googleUserData: any,
    role: UserRole = UserRole.EMPLOYER,
  ) {
    // NOTE (pre-existing, unrelated to this refactor): the "attach googleId to
    // an existing user found by email" branch below calls createUser with the
    // existing user's fields, which inserts a *new* row rather than updating
    // the found one. Left as-is per plan — flagged, not fixed here.
    const { email, googleId, fullName } = googleUserData;

    let user = await this.usersService.findByGoogleId(googleId);

    if (!user) {
      user = await this.usersService.findByEmail(email);

      if (user) {
        await this.usersService.createUser({
          ...user,
          googleId,
        });
      } else if (role === UserRole.JOB_SEEKER) {
        user = await this.db.transaction(async (tx) => {
          const [newUser] = await tx
            .insert(users)
            .values({
              email,
              googleId,
              role: UserRole.JOB_SEEKER,
              authProvider: AuthProvider.GOOGLE,
              isEmailVerified: true,
            })
            .returning();

          await this.jobSeekerProfileService.create(
            {
              userId: newUser.id,
              fullName,
            },
            tx,
          );

          return newUser;
        });
      } else {
        user = await this.db.transaction(async (tx) => {
          const [newUser] = await tx
            .insert(users)
            .values({
              email,
              googleId,
              role: UserRole.EMPLOYER,
              authProvider: AuthProvider.GOOGLE,
              isEmailVerified: true,
            })
            .returning();

          await this.employerProfileService.create(
            {
              userId: newUser.id,
              fullName,
            },
            tx,
          );

          return newUser;
        });
      }
    }

    return this.login(user);
  }
}
