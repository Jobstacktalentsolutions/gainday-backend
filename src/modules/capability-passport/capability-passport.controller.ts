import { Controller, Get, UseGuards } from '@nestjs/common';
import { CapabilityPassportService } from './capability-passport.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';

interface AuthenticatedJobSeeker {
  profileId: string;
}

@Controller('capability-passport')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CapabilityPassportController {
  constructor(
    private readonly capabilityPassportService: CapabilityPassportService,
  ) {}

  @Get('me')
  @Roles(UserRole.JOB_SEEKER)
  getMyPassport(@CurrentUser() user: AuthenticatedJobSeeker) {
    return this.capabilityPassportService.getCandidatePassport(user.profileId);
  }
}
