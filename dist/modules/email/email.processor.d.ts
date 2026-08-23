import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailService, EmailPayload } from './email.service';
export interface EmailJob extends EmailPayload {
    id?: string;
}
export declare class EmailProcessor extends WorkerHost {
    private emailService;
    private readonly logger;
    constructor(emailService: EmailService);
    process(job: Job<EmailJob | {
        recipients: string[];
        subject: string;
        template: string;
        context?: Record<string, any>;
    }>): Promise<any>;
}
