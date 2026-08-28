import { Controller, Post, Body, Get, Query, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER, UserRole.ADMIN)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  @Get('quote')
  async getQuote(@Query('candidates') count: string) {
    const parsedCount = parseInt(count || '1', 10);
    return this.paymentsService.calculateQuote(parsedCount);
  }

  @Post('checkout')
  async checkout(@Body() body: { candidateIds: string[] }, @CurrentUser() user: any) {
    if (user.role !== UserRole.ADMIN) {
      for (const submissionId of body.candidateIds) {
        const submission = await this.submissionsService.findById(submissionId);
        if (!submission) {
          throw new NotFoundException(`Submission ${submissionId} not found`);
        }
        if (submission.job.employerId !== user.id) {
          throw new ForbiddenException('You may only unlock candidates for your own jobs');
        }
      }
    }
    return this.paymentsService.processUnlockCheckout(body.candidateIds);
  }
}
