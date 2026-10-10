import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../email/email-queue.service';
import { UserRole } from '../../db/schema/users.schema';

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

  async sendVerificationEmail(
    to: string,
    token: string,
    role: UserRole = UserRole.EMPLOYER,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('email.appUrl');
    const rolePath = role === UserRole.JOB_SEEKER ? 'candidate' : 'employer';
    const verifyLink = `${appUrl}/${rolePath}/verify-email?token=${token}`;
    const year = new Date().getFullYear();

    await this.emailQueueService.enqueueEmail({
      to,
      subject: 'Verify your Gainday email',
      template: 'email-verification',
      context: {
        verifyLink,
        year,
      },
    });

    this.logger.log(`Email verification email enqueued for ${to}`);
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
    role: UserRole = UserRole.EMPLOYER,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('email.appUrl');
    const rolePath = role === UserRole.JOB_SEEKER ? 'candidate' : 'employer';
    const link = `${appUrl}/${rolePath}/reset-password?token=${token}`;
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

  async sendAdmin2faEmail(to: string, otp: string): Promise<void> {
    const appUrl = this.configService.get<string>('email.appUrl');
    const year = new Date().getFullYear();

    await this.emailQueueService.enqueueEmail({
      to,
      subject: `Your Gainday Admin Verification Code: ${otp}`,
      template: 'admin-2fa',
      context: {
        otp,
        appUrl,
        year,
      },
    });

    this.logger.log(`Admin 2FA verification email enqueued for ${to}`);
  }

  async sendAdminInviteEmail(
    to: string,
    fullName: string,
    role: string,
    temporaryPassword: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('email.appUrl') || 'http://localhost:5173';
    const loginUrl = `${appUrl}/admin/login`;
    const year = new Date().getFullYear();

    await this.emailQueueService.enqueueEmail({
      to,
      subject: 'Welcome to the Gainday Admin Team - Your Login Credentials',
      template: 'admin-invite',
      context: {
        email: to,
        fullName,
        role: role === 'MANAGER' ? 'Manager' : 'Moderator',
        temporaryPassword,
        loginUrl,
        appUrl,
        year,
      },
    });

    this.logger.log(`Admin invite email enqueued for ${to}`);
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
    /** Per-task concise reasons (GradingService's TaskGradingResult.summary) — gives the
     *  candidate a specific "why" per question rather than just the numeric breakdown. */
    taskBreakdown?: { title: string; summary: string }[],
    submissionId?: string,
    companyName?: string | null,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('email.appUrl');
    const resultUrl = submissionId
      ? `${appUrl}/job-board/submissions/${submissionId}/result`
      : `${appUrl}/candidate/profile`;
    const year = new Date().getFullYear();

    await this.emailQueueService.enqueueEmail({
      to: candidateEmail,
      subject: `Your work simulation results for ${jobTitle} are ready`,
      template: 'scoring-results',
      context: {
        jobTitle,
        companyName,
        overallScore,
        categoryScores,
        taskBreakdown,
        dashboardUrl: resultUrl,
        resultUrl,
        year,
      },
    });

    this.logger.log(`Scoring results email enqueued for ${candidateEmail}`);
  }

  async sendSupportInquiryEmail(
    name: string,
    userEmail: string,
    topic: string,
    message: string,
    messageId: string,
  ): Promise<void> {
    const supportEmail =
      this.configService.get<string>('email.supportEmail') || 'support@gainday.com';
    const appUrl = this.configService.get<string>('email.appUrl') || 'http://localhost:3000';
    const year = new Date().getFullYear();

    await this.emailQueueService.enqueueEmail({
      to: supportEmail,
      subject: `[Support Request] ${topic}: ${name}`,
      template: 'support-request',
      context: {
        name,
        userEmail,
        topic,
        message,
        messageId,
        appUrl,
        year,
      },
      replyTo: userEmail,
    });

    this.logger.log(`Support inquiry email enqueued for support team regarding ${userEmail}`);
  }
}

