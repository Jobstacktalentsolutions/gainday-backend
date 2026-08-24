import {
  Controller,
  Post,
  Get,
  Body,
  UnauthorizedException,
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
import { SignupEmployerDto } from './dto/signup-employer.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = await this.authService.login(user);

    if (!user.isEmailVerified) {
      await this.authService.resendVerificationEmail(user.email);
    }

    this.setAuthCookie(res, result.access_token);
    return {
      ...result,
      isEmailVerified: user.isEmailVerified,
    };
  }

  @Post('signup')
  async signup(@Body() signupDto: SignupEmployerDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.registerEmployer(signupDto);
    this.setAuthCookie(res, result.access_token);
    return {
      ...result,
      isEmailVerified: false,
    };
  }

  @Post('register/employer')
  async registerEmployer(@Body() signupDto: SignupEmployerDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.registerEmployer(signupDto);
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @Post('register/candidate')
  async registerCandidate(@Body() body: any) {
    return this.authService.registerJobSeeker(body.email, body.password, body.fullName);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { message: 'If an account with that email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successfully' };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      return res.redirect(`${this.configService.get('frontendUrl')}/employer/verify-email?error=true`);
    }

    const verified = await this.authService.verifyEmail(token);
    const frontendUrl = this.configService.get('frontendUrl');

    if (verified) {
      return res.redirect(`${frontendUrl}/employer/verify-email?verified=true`);
    } else {
      return res.redirect(`${frontendUrl}/employer/verify-email?error=true`);
    }
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@CurrentUser() user: any, @Res() res: Response) {
    const result = await this.authService.validateGoogleUser(user);
    const frontendUrl = this.configService.get('frontendUrl');

    this.setAuthCookie(res, result.access_token);

    return res.redirect(
      `${frontendUrl}/employer/oauth/callback?token=${result.access_token}`,
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
