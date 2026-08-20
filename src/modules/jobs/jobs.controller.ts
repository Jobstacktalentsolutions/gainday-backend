import { Controller, Get, Post, Body, Param, Put, Request } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async getActiveJobs() {
    return this.jobsService.findAllActive();
  }

  @Get(':id')
  async getJobById(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }

  @Post()
  async createJob(@Request() req: any, @Body() body: any) {
    // Requires authentication to extract employer ID, using hardcoded fallback for dev
    const employerId = req.user?.id || 'dev-employer-id';
    return this.jobsService.createJob(employerId, body);
  }

  @Put(':id/publish')
  async publishJob(@Param('id') id: string) {
    return this.jobsService.publishJob(id);
  }
}
