import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ejs from 'ejs';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  template: string;
  context?: Record<string, any>;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;
  private frontendUrl: string;
  private readonly breevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('email.brevoApiKey', '');
    this.fromEmail = this.configService.get<string>(
      'email.fromEmail',
      'noreply@gainday.com',
    );
    this.fromName = this.configService.get<string>('email.fromName', 'Gainday');
    this.frontendUrl = this.configService.get<string>(
      'frontendUrl',
      'http://localhost:5173',
    );

    if (!this.apiKey) {
      this.logger.warn('Brevo API key not configured');
    }
  }

  async renderTemplate(
    templateName: string,
    context: Record<string, any> = {},
  ): Promise<string> {
    try {
      const templatesDir = path.join(
        process.cwd(),
        'src',
        'templates',
        'emails',
      );
      const templatePath = path.join(templatesDir, `${templateName}.ejs`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Email template not found: ${templatePath}`);
      }

      // Add frontend URL and logo to all templates
      const enrichedContext = {
        ...context,
        frontendUrl: this.frontendUrl,
        logoUrl: `${this.frontendUrl}/gainday.svg`,
        year: context.year || new Date().getFullYear(),
      };

      // Render the template with proper directory configuration for includes
      const html = await ejs.renderFile(templatePath, enrichedContext, {
        async: true,
        filename: templatePath,
        views: [templatesDir],
      });

      return html;
    } catch (error) {
      this.logger.error(`Failed to render template ${templateName}:`, error);
      throw error;
    }
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    try {
      const html = await this.renderTemplate(payload.template, payload.context);

      const toList = Array.isArray(payload.to)
        ? payload.to.map((email) => ({ email }))
        : [{ email: payload.to }];

      const emailData: Record<string, any> = {
        to: toList,
        subject: payload.subject,
        htmlContent: html,
        sender: {
          name: this.fromName,
          email: this.fromEmail,
        },
      };

      if (payload.replyTo) {
        emailData.replyTo = { email: payload.replyTo };
      }

      if (payload.cc && payload.cc.length > 0) {
        emailData.cc = payload.cc.map((email) => ({ email }));
      }

      if (payload.bcc && payload.bcc.length > 0) {
        emailData.bcc = payload.bcc.map((email) => ({ email }));
      }

      await axios.post(this.breevoApiUrl, emailData, {
        headers: {
          accept: 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
      });

      this.logger.log(
        `Email sent successfully to ${Array.isArray(payload.to) ? payload.to.join(', ') : payload.to}`,
      );
    } catch (error: any) {
      if (error.isAxiosError) {
        const status = error.response?.status;
        const data = error.response?.data;
        const errMsg = `Failed to send email: Status ${status} - ${JSON.stringify(data)}`;
        this.logger.error(errMsg);
        throw new Error(errMsg);
      }
      this.logger.error(`Failed to send email: ${error.message || error}`);
      throw error;
    }
  }

  async sendBatchEmail(
    recipients: string[],
    subject: string,
    template: string,
    context: Record<string, any> = {},
  ): Promise<void> {
    try {
      const html = await this.renderTemplate(template, context);

      const toList = recipients.map((email) => ({ email }));

      const emailData = {
        to: toList,
        subject,
        htmlContent: html,
        sender: {
          name: this.fromName,
          email: this.fromEmail,
        },
      };

      await axios.post(this.breevoApiUrl, emailData, {
        headers: {
          accept: 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
      });

      this.logger.log(`Batch email sent to ${recipients.length} recipients`);
    } catch (error: any) {
      if (error.isAxiosError) {
        const status = error.response?.status;
        const data = error.response?.data;
        const errMsg = `Failed to send batch email: Status ${status} - ${JSON.stringify(data)}`;
        this.logger.error(errMsg);
        throw new Error(errMsg);
      }
      this.logger.error(
        `Failed to send batch email: ${error.message || error}`,
      );
      throw error;
    }
  }
}
