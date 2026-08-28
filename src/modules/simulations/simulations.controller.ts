import { Controller, Get, Param, Post, Put, Body, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SimulationsService } from './simulations.service';
import { JobsService } from '../jobs/jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';

@Controller('simulations')
export class SimulationsController {
  constructor(
    private readonly simulationsService: SimulationsService,
    private readonly jobsService: JobsService,
  ) {}

  @Get('job/:jobId')
  async getByJob(@Param('jobId') jobId: string) {
    return this.simulationsService.findByJobId(jobId);
  }

  @Post('job/:jobId/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async generateForJob(@Param('jobId') jobId: string, @CurrentUser() user: any) {
    const job = await this.jobsService.findById(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (user.role !== UserRole.ADMIN && job.employerId !== user.id) {
      throw new ForbiddenException('You may only generate simulations for your own jobs');
    }
    return this.simulationsService.generateSimulation(job);
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
    if (user.role !== UserRole.ADMIN && job.employerId !== user.id) {
      throw new ForbiddenException('You may only edit simulations for your own jobs');
    }
    return this.simulationsService.updateSimulationTasks(id, body.tasks);
  }
}
