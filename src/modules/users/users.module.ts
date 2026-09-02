import { Module, forwardRef } from '@nestjs/common';
import { AuthUsersService } from './auth-users.service';
import { EmployerProfileService } from './employer-profile.service';
import { JobSeekerProfileService } from './job-seeker-profile.service';
import { AdminProfileService } from './admin-profile.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [
    AuthUsersService,
    EmployerProfileService,
    JobSeekerProfileService,
    AdminProfileService,
  ],
  exports: [
    AuthUsersService,
    EmployerProfileService,
    JobSeekerProfileService,
    AdminProfileService,
  ],
})
export class UsersModule {}
