import {
  Controller,
  Get,
  Param,
  Post,
  Put,
  Sse,
  Body,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SimulationsService } from './simulations.service';
import { GenerationService } from '../generation/generation.service';
import { JobsService } from '../jobs/jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';
import { RoleRegistry } from '../generation/roles/role-registry';
import { validateSimulationTasks } from './simulation-task.validator';

interface RegenerateTaskEvent {
  data: { type: 'status' | 'task' | 'done' | 'error'; payload: unknown };
}

const MAX_REGENERATE_ALL_COUNT = 20;

@Controller('simulations')
export class SimulationsController {
  constructor(
    private readonly simulationsService: SimulationsService,
    private readonly generationService: GenerationService,
    private readonly jobsService: JobsService,
    private readonly roleRegistry: RoleRegistry,
  ) {}

  @Get('job/:jobId')
  async getByJob(@Param('jobId') jobId: string) {
    return this.simulationsService.findByJobId(jobId);
  }

  @Post('job/:jobId/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async generateForJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: any,
  ) {
    const job = await this.jobsService.findById(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (user.role !== UserRole.ADMIN && job.employerId !== user.profileId) {
      throw new ForbiddenException(
        'You may only generate simulations for your own jobs',
      );
    }
    await this.generationService.queueGeneration(job.id);
    return { status: 'queued', jobId: job.id };
  }

  private async assertCanEditJob(jobId: string, user: any) {
    const job = await this.jobsService.findById(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (user.role !== UserRole.ADMIN && job.employerId !== user.profileId) {
      throw new ForbiddenException(
        'You may only regenerate tasks for your own jobs',
      );
    }
  }

  @Post('job/:jobId/regenerate-task')
  @Sse()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  regenerateTask(
    @Param('jobId') jobId: string,
    @Body() body: { guidance?: string },
    @CurrentUser() user: any,
  ): Observable<RegenerateTaskEvent> {
    return new Observable((subscriber) => {
      void (async () => {
        try {
          await this.assertCanEditJob(jobId, user);

          subscriber.next({ data: { type: 'status', payload: 'generating' } });

          const task = await this.generationService.regenerateTask(
            jobId,
            body?.guidance,
          );

          subscriber.next({ data: { type: 'task', payload: task } });
          subscriber.complete();
        } catch (err) {
          subscriber.next({
            data: {
              type: 'error',
              payload: err instanceof Error ? err.message : 'Unknown error',
            },
          });
          subscriber.complete();
        }
      })();
    });
  }

  /**
   * Streams a fresh regeneration of every current task slot, one at a time, over the same SSE
   * mechanism as regenerate-task — used for the Simulation Builder's "Regenerate" (all tasks)
   * action. Deliberately does NOT re-run the full graph via the BullMQ queue: by the time this is
   * callable, job_extractions already exists (the initial generation already ran), so there's no
   * reason to pay for a fresh extraction/overgenerate/critic pass just to refresh every task —
   * this reuses the same lightweight, critic-skipping path as a single-task regenerate, looped.
   * Each task streams back as soon as it's ready, so the UI can fill in progressively rather than
   * blocking on one opaque wait (and unlike the queued full-graph path, there's no BullMQ-worker
   * lag between "triggered" and "actually in progress" to race against on the client).
   */
  @Post('job/:jobId/regenerate-all-tasks')
  @Sse()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  regenerateAllTasks(
    @Param('jobId') jobId: string,
    @Body() body: { count: number },
    @CurrentUser() user: any,
  ): Observable<RegenerateTaskEvent> {
    return new Observable((subscriber) => {
      void (async () => {
        try {
          await this.assertCanEditJob(jobId, user);

          const count = Math.max(
            1,
            Math.min(Math.floor(body?.count) || 1, MAX_REGENERATE_ALL_COUNT),
          );

          for (let i = 0; i < count; i++) {
            subscriber.next({
              data: { type: 'status', payload: `generating ${i + 1}/${count}` },
            });
            const task = await this.generationService.regenerateTask(jobId);
            subscriber.next({ data: { type: 'task', payload: task } });
          }

          subscriber.next({ data: { type: 'done', payload: null } });
          subscriber.complete();
        } catch (err) {
          subscriber.next({
            data: {
              type: 'error',
              payload: err instanceof Error ? err.message : 'Unknown error',
            },
          });
          subscriber.complete();
        }
      })();
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async updateTasks(
    @Param('id') id: string,
    @Body() body: { tasks: any[] },
    @CurrentUser() user: any,
  ) {
    const simulation = await this.simulationsService.findById(id);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }
    const job = await this.jobsService.findById(simulation.jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (user.role !== UserRole.ADMIN && job.employerId !== user.profileId) {
      throw new ForbiddenException(
        'You may only edit simulations for your own jobs',
      );
    }
    const validatedTasks = validateSimulationTasks(
      body.tasks,
      this.roleRegistry,
    );
    return this.simulationsService.updateSimulationTasks(id, validatedTasks);
  }
}
