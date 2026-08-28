import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../email/email-queue.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`Sending email to ${to} with subject: "${subject}"`);
    this.logger.log(`Email body: ${body}`);
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get('frontendUrl');
    const appUrl = this.configService.get<string>('email.appUrl');
    const verifyLink = `${appUrl}/auth/verify-email?token=${token}`;
    const year = new Date().getFullYear();

    await this.emailQueueService.enqueueEmail({
      to,
      subject: 'Verify your Gainday email',
      template: 'email-verification',
      context: {
        verifyLink,
        year,
        frontendUrl,
      },
    });

    this.logger.log(`Email verification email enqueued for ${to}`);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get('frontendUrl');
    const link = `${frontendUrl}/employer/reset-password?token=${token}`;
    const year = new Date().getFullYear();

    await this.emailQueueService.enqueueEmail({
      to,
      subject: 'Reset your Gainday password',
      template: 'password-reset',
      context: {
        resetLink: link,
        year,
        expiryHours: 24,
      },
    });

    this.logger.log(`Password reset email enqueued for ${to}`);
  }

  async sendBatchNotification(
    employerEmail: string,
    candidateCount: number,
    jobTitle: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('email.appUrl');
    const year = new Date().getFullYear();

    await this.emailQueueService.enqueueEmail({
      to: employerEmail,
      subject: `New submissions for ${jobTitle}`,
      template: 'batch-submission-notification',
      context: {
        candidateCount,
        jobTitle,
        jobId: '',
        appUrl,
        year,
      },
    });

    this.logger.log(
      `Batch submission notification enqueued for ${employerEmail}`,
    );
  }

  async sendScoringResultsEmail(
    candidateEmail: string,
    jobTitle: string,
    overallScore: number,
    categoryScores?: Record<string, number>,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('email.appUrl');
    const dashboardUrl = `${appUrl}/dashboard`;
    const year = new Date().getFullYear();

    await this.emailQueueService.enqueueEmail({
      to: candidateEmail,
      subject: `Your work simulation results for ${jobTitle} are ready`,
      template: 'scoring-results',
      context: {
        jobTitle,
        overallScore,
        categoryScores,
        dashboardUrl,
        year,
      },
    });

    this.logger.log(`Scoring results email enqueued for ${candidateEmail}`);
  }
}
