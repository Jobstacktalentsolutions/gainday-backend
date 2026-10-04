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

  private admin2faChallenges = new Map<string, {
    challengeToken: string;
    userId: string;
    email: string;
    otp: string;
    expiresAt: number;
    lastSentAt: number;
  }>();

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

  async initiateAdminLogin(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('Access denied. Administrator privileges required.');
    }

    // Generate 6-digit OTP and UUID challenge token
    const otp = crypto.randomInt(100000, 999999).toString();
    const challengeToken = crypto.randomUUID();
    const now = Date.now();

    // Clean up expired challenges
    for (const [token, challenge] of this.admin2faChallenges.entries()) {
      if (challenge.expiresAt < now) {
        this.admin2faChallenges.delete(token);
      }
    }

    // 10 minutes expiry
    this.admin2faChallenges.set(challengeToken, {
      challengeToken,
      userId: user.id,
      email: user.email,
      otp,
      expiresAt: now + 10 * 60 * 1000,
      lastSentAt: now,
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
      throw new BadRequestException('2FA verification code has expired. Please sign in again.');
    }

    if (challenge.otp !== otp.trim()) {
      throw new BadRequestException('Invalid verification code. Please check your email and try again.');
    }

    // OTP verified successfully — clear challenge
    this.admin2faChallenges.delete(challengeToken);

    const user = await this.usersService.findById(challenge.userId);
    if (!user || user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('Administrator account not found or deactivated');
    }

    return this.login(user);
  }

  async resendAdmin2fa(challengeToken: string) {
    const challenge = this.admin2faChallenges.get(challengeToken);
    if (!challenge) {
      throw new BadRequestException('2FA verification session not found or expired. Please sign in again.');
    }

    const now = Date.now();
    // 60-second cooldown
    if (now - challenge.lastSentAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (now - challenge.lastSentAt)) / 1000);
      throw new BadRequestException(`Please wait ${waitSeconds}s before requesting a new code.`);
    }

    const newOtp = crypto.randomInt(100000, 999999).toString();
    challenge.otp = newOtp;
    challenge.lastSentAt = now;
    challenge.expiresAt = now + 10 * 60 * 1000;

    await this.notificationsService.sendAdmin2faEmail(challenge.email, newOtp);

    return {
      success: true,
      message: 'A fresh verification code has been sent to your email.',
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
      const issuedAt =
        emailVerificationExpires.getTime() - EMAIL_VERIFICATION_TTL_MS;
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
