import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../email/email-queue.service';
export declare class NotificationsService {
    private readonly configService;
    private readonly emailQueueService;
    private readonly logger;
    constructor(configService: ConfigService, emailQueueService: EmailQueueService);
    sendEmail(to: string, subject: string, body: string): Promise<void>;
    sendVerificationEmail(to: string, token: string): Promise<void>;
    sendPasswordResetEmail(to: string, token: string): Promise<void>;
    sendBatchNotification(employerEmail: string, candidateCount: number, jobTitle: string): Promise<void>;
    sendScoringResultsEmail(candidateEmail: string, jobTitle: string, overallScore: number, categoryScores?: Record<string, number>): Promise<void>;
}
