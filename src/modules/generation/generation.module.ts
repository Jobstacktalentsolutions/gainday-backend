import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GENERATION_QUEUE } from './generation.constants';
import { GenerationService } from './generation.service';
import { GenerationProcessor } from './generation.processor';
import { GenerationProgressService } from './generation-progress.service';
import { GenerationTestController } from './generation-test.controller';
import { RoleRegistry } from './roles/role-registry';

@Module({
  imports: [BullModule.registerQueue({ name: GENERATION_QUEUE })],
  controllers: [GenerationTestController],
  providers: [
    GenerationService,
    GenerationProcessor,
    GenerationProgressService,
    RoleRegistry,
  ],
  exports: [GenerationService, GenerationProgressService, RoleRegistry],
})
export class GenerationModule {}
