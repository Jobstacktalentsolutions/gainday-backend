import { Inject, Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUsersService } from '../users/auth-users.service';
import { EmployerProfileService } from '../users/employer-profile.service';
import { JobSeekerProfileService } from '../users/job-seeker-profile.service';
import { AdminProfileService } from '../users/admin-profile.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole, AuthProvider, users } from '../../db/schema';
import { SignupEmployerDto } from './dto/signup-employer.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
        tx as unknown as DrizzleDb,
      );

      return newUser;
    });

    await this.notificationsService.sendVerificationEmail(
      email,
      emailVerificationToken,
    );

    return this.login(user);
  }

  async registerJobSeeker(email: string, password: string, fullName: string) {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
        tx as unknown as DrizzleDb,
      );

      return newUser;
    });

    await this.notificationsService.sendVerificationEmail(
      email,
      emailVerificationToken,
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
    await this.notificationsService.sendPasswordResetEmail(email, resetToken);
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

  async verifyEmail(token: string): Promise<boolean> {
    const result = await this.usersService.verifyEmailByToken(token);
    return !!result;
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }

    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.updateVerificationToken(
      user.id,
      emailVerificationToken,
      emailVerificationExpires,
    );
    await this.notificationsService.sendVerificationEmail(
      email,
      emailVerificationToken,
    );
  }

  async validateGoogleUser(googleUserData: any) {
    // NOTE (pre-existing, unrelated to this refactor): this always creates an
    // EMPLOYER regardless of signup intent, and the "attach googleId to an
    // existing user found by email" branch below calls createUser with the
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
            tx as unknown as DrizzleDb,
          );

          return newUser;
        });
      }
    }

    return this.login(user);
  }
}
