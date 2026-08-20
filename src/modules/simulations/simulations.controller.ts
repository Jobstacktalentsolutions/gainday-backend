import { Controller, Get, Param, Post, Put, Body } from '@nestjs/common';
import { SimulationsService } from './simulations.service';
import { JobsService } from '../jobs/jobs.service';

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
  async generateForJob(@Param('jobId') jobId: string) {
    const job = await this.jobsService.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    return this.simulationsService.generateSimulation(job);
  }

  @Put(':id')
  async updateTasks(@Param('id') id: string, @Body() body: { tasks: any[] }) {
    return this.simulationsService.updateSimulationTasks(id, body.tasks);
  }
}
