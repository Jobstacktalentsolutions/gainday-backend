import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUsersService } from './auth-users.service';
import { EmployerProfileService } from './employer-profile.service';
import { JobSeekerProfileService } from './job-seeker-profile.service';
import { AdminProfileService } from './admin-profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly authUsersService: AuthUsersService,
    private readonly employerProfileService: EmployerProfileService,
    private readonly jobSeekerProfileService: JobSeekerProfileService,
    private readonly adminProfileService: AdminProfileService,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Get(':id')
  async getUserById(@Param('id') id: string, @CurrentUser() currentUser: any) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('You may only access your own user record');
    }

    const user = await this.authUsersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.getProfileForUser(user.id, user.role);
    return { ...user, ...profile };
  }

  private async getProfileForUser(userId: string, role: UserRole) {
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
