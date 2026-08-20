import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`Sending email to ${to} with subject: "${subject}"`);
    // Placeholder for actual mail service integration (e.g. SendGrid, Mailgun)
  }

  async sendBatchNotification(employerEmail: string, candidateCount: number, jobTitle: string): Promise<void> {
    const subject = `New submissions for ${jobTitle}`;
    const body = `You have received ${candidateCount} new submissions for your job post "${jobTitle}". Log in to review them.`;
    await this.sendEmail(employerEmail, subject, body);
  }
}
