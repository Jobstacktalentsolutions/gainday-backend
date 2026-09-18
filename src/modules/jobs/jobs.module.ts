import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobDescriptionParserService } from './job-description-parser.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [JobsController],
  providers: [JobsService, JobDescriptionParserService],
  exports: [JobsService],
})
export class JobsModule {}
