import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { supportMessages, SupportMessage } from '../../db/schema';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createMessage(
    dto: CreateSupportMessageDto,
  ): Promise<{ success: boolean; message: string; id: string }> {
    const [inserted] = await this.db
      .insert(supportMessages)
      .values({
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        topic: dto.topic.trim(),
        message: dto.message.trim(),
        status: 'pending',
      })
      .returning();

    this.logger.log(
      `Support message created (ID: ${inserted.id}) from ${inserted.email} [Topic: ${inserted.topic}]`,
    );

    // Enqueue email notification to support team
    try {
      await this.notificationsService.sendSupportInquiryEmail(
        inserted.name,
        inserted.email,
        inserted.topic,
        inserted.message,
        inserted.id,
      );
    } catch (err) {
      this.logger.error('Failed to enqueue support notification email', err);
    }

    return {
      success: true,
      message:
        'Your support request has been submitted successfully. Our team will get back to you shortly.',
      id: inserted.id,
    };
  }
}
