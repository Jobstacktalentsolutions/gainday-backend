import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Put,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';
import { CreateJobDto } from './dto/create-job.dto';
import { SaveDraftJobDto } from './dto/save-draft-job.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async getActiveJobs() {
    return this.jobsService.findAllActive();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  async getMyJobs(@CurrentUser() user: any) {
    return this.jobsService.findByEmployer(user.profileId);
  }

  @Get(':id')
  async getJobById(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }

  @Post('draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  async saveDraft(@CurrentUser() user: any, @Body() dto: SaveDraftJobDto) {
    return this.jobsService.saveDraft(user.profileId, dto);
  }

  @Patch('draft/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  async updateDraft(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SaveDraftJobDto,
  ) {
    return this.jobsService.saveDraft(user.profileId, dto, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  async createJob(@CurrentUser() user: any, @Body() dto: CreateJobDto) {
    return this.jobsService.saveDetails(user.profileId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  async updateJob(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.saveDetails(user.profileId, dto, id);
  }

  @Put(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async publishJob(@Param('id') id: string, @CurrentUser() user: any) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (user.role !== UserRole.ADMIN && job.employerId !== user.profileId) {
      throw new ForbiddenException('You may only publish your own jobs');
    }
    return this.jobsService.publishJob(id);
  }
}
