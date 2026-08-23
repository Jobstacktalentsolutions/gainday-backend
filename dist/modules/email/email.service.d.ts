import { ConfigService } from '@nestjs/config';
export interface EmailPayload {
    to: string | string[];
    subject: string;
    template: string;
    context?: Record<string, any>;
    replyTo?: string;
    cc?: string[];
    bcc?: string[];
}
export declare class EmailService {
    private configService;
    private readonly logger;
    private apiKey;
    private fromEmail;
    private fromName;
    private frontendUrl;
    private readonly breevoApiUrl;
    constructor(configService: ConfigService);
    renderTemplate(templateName: string, context?: Record<string, any>): Promise<string>;
    sendEmail(payload: EmailPayload): Promise<void>;
    sendBatchEmail(recipients: string[], subject: string, template: string, context?: Record<string, any>): Promise<void>;
}
