import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailPayload } from './email.service';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  async enqueueEmail(payload: EmailPayload, delayMs?: number): Promise<string> {
    try {
      const job = await this.emailQueue.add('default', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Email job enqueued with ID: ${job.id}`);
      return (job.id || '').toString();
    } catch (error) {
      this.logger.error(`Failed to enqueue email:`, error);
      throw error;
    }
  }

  async enqueueBatchEmail(recipients: string[], subject: string, template: string, context?: Record<string, any>, delayMs?: number): Promise<string> {
    try {
      const job = await this.emailQueue.add(
        'batch',
        {
          recipients,
          subject,
          template,
          context,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          delay: delayMs,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      this.logger.log(`Batch email job enqueued with ID: ${job.id} for ${recipients.length} recipients`);
      return (job.id || '').toString();
    } catch (error) {
      this.logger.error(`Failed to enqueue batch email:`, error);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.emailQueue.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        id: job.id,
        state: await job.getState(),
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        attempts: job.attemptsMade,
        delay: job.delay,
      };
    } catch (error) {
      this.logger.error(`Failed to get job status:`, error);
      throw error;
    }
  }
}
