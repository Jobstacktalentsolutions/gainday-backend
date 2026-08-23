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
  private readonly breevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('email.brevoApiKey', '');
    this.fromEmail = this.configService.get<string>('email.fromEmail', 'noreply@gainday.com');
    this.fromName = this.configService.get<string>('email.fromName', 'Gainday');

    if (!this.apiKey) {
      this.logger.warn('Brevo API key not configured');
    }
  }

  async renderTemplate(templateName: string, context: Record<string, any> = {}): Promise<string> {
    try {
      const templatePath = path.join(process.cwd(), 'src', 'templates', 'emails', `${templateName}.ejs`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Email template not found: ${templatePath}`);
      }

      const html = await ejs.renderFile(templatePath, context, {
        async: true,
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
        ? payload.to.map((email) => ({ email, name: '' }))
        : [{ email: payload.to, name: '' }];

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

      this.logger.log(`Email sent successfully to ${Array.isArray(payload.to) ? payload.to.join(', ') : payload.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email:`, error);
      throw error;
    }
  }

  async sendBatchEmail(recipients: string[], subject: string, template: string, context: Record<string, any> = {}): Promise<void> {
    try {
      const html = await this.renderTemplate(template, context);

      const toList = recipients.map((email) => ({ email, name: '' }));

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
    } catch (error) {
      this.logger.error(`Failed to send batch email:`, error);
      throw error;
    }
  }
}
