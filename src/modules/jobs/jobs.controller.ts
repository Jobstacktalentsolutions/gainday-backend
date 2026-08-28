import { Controller, Get, Post, Body, Param, Put, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  async createJob(@CurrentUser() user: any, @Body() body: any) {
    return this.jobsService.createJob(user.id, body);
  }

  @Put(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async publishJob(@Param('id') id: string, @CurrentUser() user: any) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (user.role !== UserRole.ADMIN && job.employerId !== user.id) {
      throw new ForbiddenException('You may only publish your own jobs');
    }
    return this.jobsService.publishJob(id);
  }
}
