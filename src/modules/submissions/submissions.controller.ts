import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { JobsService } from '../jobs/jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';

@Controller('submissions')
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly jobsService: JobsService,
  ) {}

  @Post('job/:jobId/start')
  @UseGuards(OptionalJwtAuthGuard)
  async startSimulation(
    @Param('jobId') jobId: string,
    @Body() body: { simulationId: string; guestInfo?: any },
    @CurrentUser() user: any,
  ) {
    return this.submissionsService.createSubmission(
      jobId,
      body.simulationId,
      user?.id,
      body.guestInfo,
    );
  }

  @Put(':id/submit')
  async submitSimulation(
    @Param('id') id: string,
    @Body() body: { answers: any[] },
  ) {
    return this.submissionsService.submitAnswers(id, body.answers);
  }

  @Get('job/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async getSubmissionsByJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: any,
  ) {
    const job = await this.jobsService.findById(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (user.role !== UserRole.ADMIN && job.employerId !== user.id) {
      throw new ForbiddenException(
        'You may only view submissions for your own jobs',
      );
    }
    return this.submissionsService.findByJob(jobId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async getSubmissionById(@Param('id') id: string, @CurrentUser() user: any) {
    const submission = await this.submissionsService.findById(id);
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (user.role !== UserRole.ADMIN && submission.job.employerId !== user.id) {
      throw new ForbiddenException(
        'You may only view submissions for your own jobs',
      );
    }
    return submission;
  }

  @Put(':id/unlock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  async unlockSubmission(@Param('id') id: string, @CurrentUser() user: any) {
    const submission = await this.submissionsService.findById(id);
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (user.role !== UserRole.ADMIN && submission.job.employerId !== user.id) {
      throw new ForbiddenException(
        'You may only unlock submissions for your own jobs',
      );
    }
    return this.submissionsService.unlockCandidate(id);
  }
}
