import { Controller, Get, Post, Put, Body, Param, Request } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post('job/:jobId/start')
  async startSimulation(
    @Param('jobId') jobId: string,
    @Body() body: { simulationId: string; guestInfo?: any },
    @Request() req: any,
  ) {
    const candidateId = req.user?.id; // Optional if logged in
    return this.submissionsService.createSubmission(
      jobId,
      body.simulationId,
      candidateId,
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
  async getSubmissionsByJob(@Param('jobId') jobId: string) {
    return this.submissionsService.findByJob(jobId);
  }

  @Get(':id')
  async getSubmissionById(@Param('id') id: string) {
    return this.submissionsService.findById(id);
  }

  @Put(':id/unlock')
  async unlockSubmission(@Param('id') id: string) {
    return this.submissionsService.unlockCandidate(id);
  }
}
