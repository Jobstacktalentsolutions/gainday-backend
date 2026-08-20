import { Controller, Post, Body, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('register/employer')
  async registerEmployer(@Body() body: any) {
    return this.authService.registerEmployer(
      body.email,
      body.password,
      body.companyName,
      body.fullName,
    );
  }

  @Post('register/candidate')
  async registerCandidate(@Body() body: any) {
    return this.authService.registerJobSeeker(
      body.email,
      body.password,
      body.fullName,
    );
  }
}
