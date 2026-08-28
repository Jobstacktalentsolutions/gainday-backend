import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService, EmailPayload } from './email.service';

export interface EmailJob extends EmailPayload {
  id?: string;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private emailService: EmailService) {
    super();
  }

  async process(
    job: Job<
      | EmailJob
      | {
          recipients: string[];
          subject: string;
          template: string;
          context?: Record<string, any>;
        }
    >,
  ): Promise<any> {
    try {
      this.logger.debug(`Processing email job ${job.id}`);

      if ('recipients' in job.data) {
        const { recipients, subject, template, context } = job.data as any;
        await this.emailService.sendBatchEmail(
          recipients,
          subject,
          template,
          context,
        );
        this.logger.log(`Batch email job ${job.id} completed successfully`);
        return {
          success: true,
          jobId: job.id,
          recipientCount: recipients.length,
        };
      } else {
        const { template, subject, to, context, replyTo, cc, bcc } = job.data;
        await this.emailService.sendEmail({
          to,
          subject,
          template,
          context,
          replyTo,
          cc,
          bcc,
        });
        this.logger.log(`Email job ${job.id} completed successfully`);
        return { success: true, jobId: job.id };
      }
    } catch (error) {
      this.logger.error(`Email job ${job.id} failed:`, error);
      throw error;
    }
  }
}
