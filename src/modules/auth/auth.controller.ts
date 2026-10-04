import {
  Controller,
  Post,
  Get,
  Body,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AdminVerify2faDto } from './dto/admin-verify-2fa.dto';
import { AdminResend2faDto } from './dto/admin-resend-2fa.dto';
import { SignupEmployerDto } from './dto/signup-employer.dto';
import { SignupJobSeekerDto } from './dto/signup-job-seeker.dto';
import { UserRole } from '../../db/schema';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SetInitialPasswordDto } from './dto/set-initial-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() loginDto: LoginDto) {
    return this.authService.initiateAdminLogin(loginDto.email, loginDto.password);
  }

  @Post('admin/verify-2fa')
  @HttpCode(HttpStatus.OK)
  async adminVerify2fa(
    @Body() dto: AdminVerify2faDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyAdmin2fa(
      dto.challengeToken,
      dto.otp,
    );
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @Post('admin/resend-2fa')
  @HttpCode(HttpStatus.OK)
  async adminResend2fa(@Body() dto: AdminResend2faDto) {
    return this.authService.resendAdmin2fa(dto.challengeToken);
  }

  @Post('admin/set-initial-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async setAdminInitialPassword(
    @CurrentUser() user: any,
    @Body() dto: SetInitialPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.setAdminInitialPassword(user.id, dto);
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = await this.authService.login(user);

    this.setAuthCookie(res, result.access_token);
    return {
      ...result,
      isEmailVerified: user.isEmailVerified,
    };
  }

  @Post('signup')
  async signup(
    @Body() signupDto: SignupEmployerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerEmployer(signupDto);
    this.setAuthCookie(res, result.access_token);
    return {
      ...result,
      isEmailVerified: false,
    };
  }

  @Post('register/employer')
  async registerEmployer(
    @Body() signupDto: SignupEmployerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerEmployer(signupDto);
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @Post('register/candidate')
  async registerCandidate(
    @Body() dto: SignupJobSeekerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerJobSeeker(dto);
    this.setAuthCookie(res, result.access_token);
    return {
      ...result,
      isEmailVerified: false,
    };
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message:
        'If an account with that email exists, a reset link has been sent',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successfully' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto);
    return { message: 'Password changed successfully' };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async confirmEmail(@Body() dto: VerifyEmailDto) {
    const verified = await this.authService.verifyEmail(dto.token);
    if (!verified) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    return { verified: true };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerificationEmail(dto.email);
    return {
      message:
        'If that account exists and is unverified, a new link has been sent',
    };
  }

  // Legacy redirect flow, kept for verification emails sent before the link
  // pointed at the frontend page.
  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
    @Query('role') role: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get('frontendUrl');
    const rolePath = role === 'JOB_SEEKER' ? 'candidate' : 'employer';

    if (!token) {
      return res.redirect(`${frontendUrl}/${rolePath}/verify-email?error=true`);
    }

    const verified = await this.authService.verifyEmail(token);

    if (verified) {
      return res.redirect(
        `${frontendUrl}/${rolePath}/verify-email?verified=true`,
      );
    } else {
      return res.redirect(`${frontendUrl}/${rolePath}/verify-email?error=true`);
    }
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @CurrentUser() user: any,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const role =
      state === 'JOB_SEEKER' ? UserRole.JOB_SEEKER : UserRole.EMPLOYER;
    const result = await this.authService.validateGoogleUser(user, role);
    const frontendUrl = this.configService.get('frontendUrl');
    const rolePath =
      result.user.role === UserRole.JOB_SEEKER ? 'candidate' : 'employer';

    this.setAuthCookie(res, result.access_token);

    return res.redirect(
      `${frontendUrl}/${rolePath}/oauth/callback?token=${result.access_token}`,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: any) {
    return {
      user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return { message: 'Logged out successfully' };
  }

  private setAuthCookie(res: Response, token: string): void {
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
