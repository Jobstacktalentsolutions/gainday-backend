import {
  Inject,
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
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
    private readonly configService?: ConfigService,
  ) {}

  private admin2faChallenges = new Map<
    string,
    {
      challengeToken: string;
      userId: string;
      email: string;
      otp: string;
      expiresAt: number;
      lastSentAt: number;
      resendCount: number;
    }
  >();

  private emailVerificationRateLimits = new Map<
    string,
    {
      count: number;
      firstRequestedAt: number;
      lastSentAt: number;
    }
  >();

  private passwordResetRateLimits = new Map<
    string,
    {
      count: number;
      firstRequestedAt: number;
      lastSentAt: number;
    }
  >();

  private getAdmin2faConfig() {
    return {
      cooldownMs:
        (this.configService?.get<number>('auth.admin2fa.cooldownSeconds') ??
          60) * 1000,
      maxResends:
        this.configService?.get<number>('auth.admin2fa.maxResends') ?? 5,
      ttlMs:
        (this.configService?.get<number>('auth.admin2fa.ttlMinutes') ?? 10) *
        60 *
        1000,
    };
  }

  private getEmailVerificationConfig() {
    return {
      cooldownMs:
        (this.configService?.get<number>(
          'auth.emailVerification.cooldownSeconds',
        ) ?? 60) * 1000,
      maxResends:
        this.configService?.get<number>(
          'auth.emailVerification.maxResends',
        ) ?? 5,
      ttlMs:
        (this.configService?.get<number>('auth.emailVerification.ttlHours') ??
          24) *
        60 *
        60 *
        1000,
    };
  }

  private getPasswordResetConfig() {
    return {
      cooldownMs:
        (this.configService?.get<number>(
          'auth.passwordReset.cooldownSeconds',
        ) ?? 60) * 1000,
      maxRequests:
        this.configService?.get<number>('auth.passwordReset.maxRequests') ?? 5,
      ttlMs:
        (this.configService?.get<number>('auth.passwordReset.ttlMinutes') ??
          60) *
        60 *
        1000,
    };
  }

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
      if (user.isActive === false) {
        const reason = user.suspensionReason ? `: ${user.suspensionReason}` : '';
        throw new ForbiddenException(
          `Your account has been suspended${reason}. Please contact support.`
        );
      }
      const { password, ...result } = user;
      return result;
    }

    return null;
  }

  async initiateAdminLogin(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('Access denied. Administrator privileges required.');
    }

    if (user.isActive === false) {
      const reason = user.suspensionReason ? `: ${user.suspensionReason}` : '';
      throw new ForbiddenException(
        `Administrator account has been suspended${reason}. Please contact support.`
      );
    }

    const config = this.getAdmin2faConfig();
    const otp = crypto.randomInt(100000, 999999).toString();
    const challengeToken = crypto.randomUUID();
    const now = Date.now();

    // Clean up expired challenges
    for (const [token, challenge] of this.admin2faChallenges.entries()) {
      if (challenge.expiresAt < now) {
        this.admin2faChallenges.delete(token);
      }
    }

    this.admin2faChallenges.set(challengeToken, {
      challengeToken,
      userId: user.id,
      email: user.email,
      otp,
      expiresAt: now + config.ttlMs,
      lastSentAt: now,
      resendCount: 0,
    });

    // Send 2FA email to admin
    await this.notificationsService.sendAdmin2faEmail(user.email, otp);

    return {
      requires2FA: true,
      challengeToken,
      emailMasked: this.maskEmail(user.email),
    };
  }

  async verifyAdmin2fa(challengeToken: string, otp: string) {
    const challenge = this.admin2faChallenges.get(challengeToken);
    if (!challenge) {
      throw new BadRequestException('2FA verification session not found or expired. Please sign in again.');
    }

    if (Date.now() > challenge.expiresAt) {
      this.admin2faChallenges.delete(challengeToken);
      throw new BadRequestException('2FA verification session not found or expired. Please sign in again.');
    }

    if (challenge.otp !== otp.trim()) {
      throw new BadRequestException('Invalid verification code. Please check your email and try again.');
    }

    // OTP verified successfully — clear challenge
    this.admin2faChallenges.delete(challengeToken);

    const user = await this.usersService.findById(challenge.userId);
    if (!user || user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('Administrator account not found');
    }

    if (user.isActive === false) {
      const reason = user.suspensionReason ? `: ${user.suspensionReason}` : '';
      throw new ForbiddenException(`Administrator account has been suspended${reason}`);
    }

    return this.login(user);
  }

  async resendAdmin2fa(challengeToken: string) {
    const challenge = this.admin2faChallenges.get(challengeToken);
    if (!challenge) {
      throw new BadRequestException('2FA verification session not found or expired. Please sign in again.');
    }

    const now = Date.now();
    if (now > challenge.expiresAt) {
      this.admin2faChallenges.delete(challengeToken);
      throw new BadRequestException('2FA verification session not found or expired. Please sign in again.');
    }

    const config = this.getAdmin2faConfig();

    if (challenge.resendCount >= config.maxResends) {
      this.admin2faChallenges.delete(challengeToken);
      throw new BadRequestException(
        `Maximum resend limit of ${config.maxResends} attempts reached. Please sign in again.`,
      );
    }

    if (now - challenge.lastSentAt < config.cooldownMs) {
      const waitSeconds = Math.ceil(
        (config.cooldownMs - (now - challenge.lastSentAt)) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${waitSeconds}s before requesting a new code.`,
      );
    }

    const newOtp = crypto.randomInt(100000, 999999).toString();
    challenge.otp = newOtp;
    challenge.lastSentAt = now;
    challenge.expiresAt = now + config.ttlMs;
    challenge.resendCount = (challenge.resendCount || 0) + 1;

    await this.notificationsService.sendAdmin2faEmail(challenge.email, newOtp);

    return {
      success: true,
      message: 'A fresh verification code has been sent to your email.',
      remainingResends: Math.max(0, config.maxResends - challenge.resendCount),
    };
  }

  private maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!domain) return email;
    if (user.length <= 2) return `${user[0]}*@${domain}`;
    return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
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

    const isSuperAdmin =
      user.role === UserRole.ADMIN &&
      (user.email === process.env.ADMIN_EMAIL ||
        user.email === 'admin@gainday.com' ||
        user.email === 'enweremproper@gmail.com' ||
        (profile as any)?.adminRole === 'SUPER_ADMIN');

    const adminRole =
      user.role === UserRole.ADMIN
        ? isSuperAdmin
          ? 'SUPER_ADMIN'
          : (profile as any)?.adminRole || 'MANAGER'
        : undefined;

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profileId: profile?.id,
        fullName: profile?.fullName,
        companyName: (profile as any)?.companyName,
        adminRole,
        isSuperAdmin,
        mustChangePassword: user.mustChangePassword ?? false,
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
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      return;
    }

    const config = this.getPasswordResetConfig();
    const now = Date.now();

    // Check sliding window rate limit for password reset requests (1 hour window)
    const rateLimit = this.passwordResetRateLimits.get(normalizedEmail);
    const windowMs = 60 * 60 * 1000;
    if (rateLimit) {
      if (now - rateLimit.firstRequestedAt > windowMs) {
        rateLimit.count = 0;
        rateLimit.firstRequestedAt = now;
      }

      if (now - rateLimit.lastSentAt < config.cooldownMs) {
        return;
      }

      if (rateLimit.count >= config.maxRequests) {
        return;
      }
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(now + config.ttlMs);

    await this.usersService.setPasswordResetToken(
      user.id,
      resetToken,
      resetExpires,
    );

    if (rateLimit) {
      rateLimit.count += 1;
      rateLimit.lastSentAt = now;
    } else {
      this.passwordResetRateLimits.set(normalizedEmail, {
        count: 1,
        firstRequestedAt: now,
        lastSentAt: now,
      });
    }

    await this.notificationsService.sendPasswordResetEmail(
      normalizedEmail,
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

    if (user.password) {
      const isSamePassword = await bcrypt.compare(password, user.password);
      if (isSamePassword) {
        throw new BadRequestException(
          'New password cannot be the same as your previous password',
        );
      }
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

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password cannot be the same as your current password',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
  }

  async setAdminInitialPassword(
    userId: string,
    dto: { newPassword: string; confirmNewPassword: string },
  ) {
    const { newPassword, confirmNewPassword } = dto;

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user || user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('Administrator account not found');
    }

    if (user.password) {
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        throw new BadRequestException(
          'New password cannot be the same as your temporary password',
        );
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    const updatedUser = await this.usersService.findById(user.id);
    return this.login(updatedUser);
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
    const normalizedEmail = email.toLowerCase().trim();
    const user =
      await this.usersService.findVerificationStateByEmail(normalizedEmail);
    if (!user || user.isEmailVerified) {
      return;
    }

    const config = this.getEmailVerificationConfig();
    const now = Date.now();

    // Check sliding window rate limit for email verification resends (1 hour window)
    const rateLimit = this.emailVerificationRateLimits.get(normalizedEmail);
    const windowMs = 60 * 60 * 1000;
    if (rateLimit) {
      if (now - rateLimit.firstRequestedAt > windowMs) {
        rateLimit.count = 0;
        rateLimit.firstRequestedAt = now;
      }

      if (now - rateLimit.lastSentAt < config.cooldownMs) {
        return;
      }

      if (rateLimit.count >= config.maxResends) {
        return;
      }
    }

    const { emailVerificationToken, emailVerificationExpires } = user;
    const liveToken =
      emailVerificationToken &&
      emailVerificationExpires &&
      emailVerificationExpires.getTime() > now
        ? emailVerificationToken
        : null;

    if (liveToken && emailVerificationExpires) {
      // Issue time is derived from the expiry, which is refreshed on each send.
      const issuedAt = emailVerificationExpires.getTime() - config.ttlMs;
      if (now - issuedAt < config.cooldownMs) {
        return;
      }
    }

    const token = liveToken ?? crypto.randomBytes(32).toString('hex');
    await this.usersService.updateVerificationToken(
      user.id,
      token,
      new Date(now + config.ttlMs),
    );

    if (rateLimit) {
      rateLimit.count += 1;
      rateLimit.lastSentAt = now;
    } else {
      this.emailVerificationRateLimits.set(normalizedEmail, {
        count: 1,
        firstRequestedAt: now,
        lastSentAt: now,
      });
    }

    await this.notificationsService.sendVerificationEmail(
      normalizedEmail,
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

    if (user && user.isActive === false) {
      const reason = user.suspensionReason ? `: ${user.suspensionReason}` : '';
      throw new ForbiddenException(
        `Your account has been suspended${reason}. Please contact support.`
      );
    }

    return this.login(user);
  }
}
