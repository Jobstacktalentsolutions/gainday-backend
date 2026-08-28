import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GENERATION_QUEUE } from './generation.constants';
import { GenerationService } from './generation.service';
import { GenerationProcessor } from './generation.processor';
import { RoleRegistry } from './roles/role-registry';

@Module({
  imports: [BullModule.registerQueue({ name: GENERATION_QUEUE })],
  providers: [GenerationService, GenerationProcessor, RoleRegistry],
  exports: [GenerationService],
})
export class GenerationModule {}
