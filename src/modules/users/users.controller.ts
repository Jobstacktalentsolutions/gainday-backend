import {
  Controller,
  Get,
  Patch,
  Body,
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
import { UpdateProfileDto } from './dto/update-profile.dto';

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

  @Patch('profile')
  async updateProfile(
    @CurrentUser() currentUser: any,
    @Body() dto: UpdateProfileDto,
  ) {
    if (currentUser.role === UserRole.EMPLOYER && currentUser.profileId) {
      await this.employerProfileService.update(currentUser.profileId, {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.phoneNumber !== undefined ? { phoneNumber: dto.phoneNumber } : {}),
      });
    } else if (currentUser.role === UserRole.JOB_SEEKER && currentUser.profileId) {
      await this.jobSeekerProfileService.update(currentUser.profileId, {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phoneNumber !== undefined ? { phoneNumber: dto.phoneNumber } : {}),
      });
    }

    const updatedProfile = await this.getProfileForUser(
      currentUser.id,
      currentUser.role,
    );

    return {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      authProvider: currentUser.authProvider,
      isEmailVerified: currentUser.isEmailVerified,
      profileId: updatedProfile?.id,
      fullName: updatedProfile?.fullName,
      companyName: (updatedProfile as any)?.companyName,
      phoneNumber: (updatedProfile as any)?.phoneNumber,
    };
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
