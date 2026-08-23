import { Queue } from 'bullmq';
import { EmailPayload } from './email.service';
export declare class EmailQueueService {
    private readonly emailQueue;
    private readonly logger;
    constructor(emailQueue: Queue);
    enqueueEmail(payload: EmailPayload, delayMs?: number): Promise<string>;
    enqueueBatchEmail(recipients: string[], subject: string, template: string, context?: Record<string, any>, delayMs?: number): Promise<string>;
    getJobStatus(jobId: string): Promise<any>;
}
