import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    // Simple placeholder for validation (bcrypt comparing)
    if (user && user.password === pass) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: 'mock-jwt-token-for-dev',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async registerEmployer(email: string, pass: string, companyName: string, fullName: string) {
    // In a real app, hash password before saving
    return this.usersService.createUser({
      email,
      password: pass,
      role: UserRole.EMPLOYER,
      companyName,
      fullName,
    });
  }

  async registerJobSeeker(email: string, pass: string, fullName: string) {
    return this.usersService.createUser({
      email,
      password: pass,
      role: UserRole.JOB_SEEKER,
      fullName,
    });
  }
}
