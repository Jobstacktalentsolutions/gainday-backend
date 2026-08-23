import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole, AuthProvider } from '../users/entities/user.entity';
import { SignupEmployerDto } from './dto/signup-employer.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
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

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        companyName: user.companyName,
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

    const user = await this.usersService.createUser({
      email,
      password: hashedPassword,
      fullName,
      companyName,
      role: UserRole.EMPLOYER,
      authProvider: AuthProvider.LOCAL,
      emailVerificationToken,
      emailVerificationExpires,
    });

    await this.notificationsService.sendVerificationEmail(email, emailVerificationToken);

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

    const user = await this.usersService.createUser({
      email,
      password: hashedPassword,
      fullName,
      role: UserRole.JOB_SEEKER,
      authProvider: AuthProvider.LOCAL,
      emailVerificationToken,
      emailVerificationExpires,
    });

    await this.notificationsService.sendVerificationEmail(email, emailVerificationToken);

    return this.login(user);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await this.usersService.setPasswordResetToken(user.id, resetToken, resetExpires);
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

  async validateGoogleUser(googleUserData: any) {
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
        user = await this.usersService.createUser({
          email,
          googleId,
          fullName,
          role: UserRole.EMPLOYER,
          authProvider: AuthProvider.GOOGLE,
          isEmailVerified: true,
        });
      }
    }

    return this.login(user);
  }
}
