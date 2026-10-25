import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobDescriptionParserService } from './job-description-parser.service';
import { JobBoardCacheService } from './job-board/job-board-cache.service';
import { JobBoardService } from './job-board/job-board.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobDescriptionParserService,
    JobBoardCacheService,
    JobBoardService,
  ],
  exports: [JobsService, JobBoardCacheService],
})
export class JobsModule {}
