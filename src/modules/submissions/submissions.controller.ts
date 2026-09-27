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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { JobsService } from '../jobs/jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, AntiCheatEvent } from '../../db/schema';

@Controller('submissions')
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly jobsService: JobsService,
  ) {}

  @Post('job/:jobId/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.JOB_SEEKER)
  async startSimulation(
    @Param('jobId') jobId: string,
    @Body() body: { simulationId: string },
    @CurrentUser() user: any,
  ) {
    return this.submissionsService.createSubmission(
      jobId,
      body.simulationId,
      user.profileId,
    );
  }

  @Put(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.JOB_SEEKER)
  async submitSimulation(
    @Param('id') id: string,
    @Body() body: { answers: any[]; antiCheatFlags?: AntiCheatEvent[] },
    @CurrentUser() user: any,
  ) {
    const submission = await this.assertOwnedByCandidate(id, user);
    return this.submissionsService.submitAnswers(
      submission.id,
      body.answers,
      body.antiCheatFlags ?? [],
    );
  }

  // POST not GET/PUT — a heartbeat is a side-effecting "I'm still here" event, not idempotent
  // state to fetch or replace.
  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.JOB_SEEKER)
  async heartbeat(@Param('id') id: string, @CurrentUser() user: any) {
    const submission = await this.assertOwnedByCandidate(id, user);
    return this.submissionsService.recordHeartbeat(submission.id);
  }

  private async assertOwnedByCandidate(submissionId: string, user: any) {
    const submission = await this.submissionsService.findById(submissionId);
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (submission.candidateId !== user.profileId) {
      throw new ForbiddenException('This submission does not belong to you');
    }
    return submission;
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
    if (user.role !== UserRole.ADMIN && job.employerId !== user.profileId) {
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
    if (
      user.role !== UserRole.ADMIN &&
      submission.job.employerId !== user.profileId
    ) {
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
    if (
      user.role !== UserRole.ADMIN &&
      submission.job.employerId !== user.profileId
    ) {
      throw new ForbiddenException(
        'You may only unlock submissions for your own jobs',
      );
    }
    return this.submissionsService.unlockCandidate(id);
  }
}
