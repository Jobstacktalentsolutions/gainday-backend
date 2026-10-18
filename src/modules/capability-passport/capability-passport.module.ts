import { Module } from '@nestjs/common';
import { CapabilityPassportService } from './capability-passport.service';
import { CapabilityPassportController } from './capability-passport.controller';
import { PassportNarrativeService } from './passport-narrative.service';
import { UsersModule } from '../users/users.module';

// AiModule is @Global(), so GRADING_MODEL is already available — no need to import it here.
@Module({
  imports: [UsersModule],
  controllers: [CapabilityPassportController],
  providers: [CapabilityPassportService, PassportNarrativeService],
  exports: [CapabilityPassportService],
})
export class CapabilityPassportModule {}
