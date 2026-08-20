export declare class NotificationsService {
    private readonly logger;
    sendEmail(to: string, subject: string, body: string): Promise<void>;
    sendBatchNotification(employerEmail: string, candidateCount: number, jobTitle: string): Promise<void>;
}
