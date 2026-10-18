import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { supportMessages, SupportMessage, users, adminProfiles, UserRole } from '../../db/schema';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private roundRobinIndex = 0;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly notificationsService: NotificationsService,
    private readonly configService?: ConfigService,
  ) {}

  /**
   * Resolves the target recipient email for support messages using round-robin:
   * 1. Fetches all active admin accounts.
   * 2. Filters out the Super Admin (identified by ADMIN_EMAIL or role SUPER_ADMIN).
   * 3. If dedicated 'SUPPORT' admins exist, uses them; otherwise uses all active support admins (MODERATOR/MANAGER).
   * 4. Cycles through the eligible pool via round-robin.
   * 5. If no support admins are present, falls back to the Super Admin email.
   */
  async resolveSupportRecipientEmail(): Promise<{
    email: string;
    assignedRole?: string | null;
    isSuperAdminFallback: boolean;
  }> {
    const superAdminEmail = (
      this.configService?.get<string>('admin.email') ||
      process.env.ADMIN_EMAIL ||
      'admin@gainday.com'
    )
      .toLowerCase()
      .trim();

    try {
      const activeAdmins = await this.db
        .select({
          id: users.id,
          email: users.email,
          fullName: adminProfiles.fullName,
          adminRole: adminProfiles.adminRole,
        })
        .from(users)
        .leftJoin(adminProfiles, eq(users.id, adminProfiles.userId))
        .where(
          and(
            eq(users.role, UserRole.ADMIN),
            eq(users.isActive, true),
          ),
        );

      // Filter out Super Admin
      const nonSuperAdmins = activeAdmins.filter((admin) => {
        const email = admin.email.toLowerCase().trim();
        const isSuper =
          email === superAdminEmail ||
          admin.adminRole?.toUpperCase() === 'SUPER_ADMIN';
        return !isSuper;
      });

      // Prefer dedicated SUPPORT admins if any exist, otherwise all active operational admins (Moderators / Managers)
      const dedicatedSupportAdmins = nonSuperAdmins.filter(
        (a) => a.adminRole?.toUpperCase() === 'SUPPORT',
      );
      const eligiblePool =
        dedicatedSupportAdmins.length > 0 ? dedicatedSupportAdmins : nonSuperAdmins;

      if (eligiblePool.length === 0) {
        this.logger.warn(
          `No active support admins found. Routing support message to Super Admin (${superAdminEmail})`,
        );
        return {
          email: superAdminEmail,
          isSuperAdminFallback: true,
        };
      }

      // Stable sorting to guarantee predictable round-robin cycling
      eligiblePool.sort((a, b) => a.email.localeCompare(b.email));

      const selected = eligiblePool[this.roundRobinIndex % eligiblePool.length];
      this.roundRobinIndex = (this.roundRobinIndex + 1) % eligiblePool.length;

      this.logger.log(
        `Round-robin selected support admin: ${selected.email} (${selected.adminRole || 'ADMIN'}) [Pool size: ${eligiblePool.length}]`,
      );

      return {
        email: selected.email,
        assignedRole: selected.adminRole,
        isSuperAdminFallback: false,
      };
    } catch (error) {
      this.logger.error(
        'Failed to resolve support admin round-robin recipient, falling back to Super Admin',
        error,
      );
      return {
        email: superAdminEmail,
        isSuperAdminFallback: true,
      };
    }
  }

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

    // Resolve recipient via round-robin (or fallback to super admin)
    const { email: recipientEmail } = await this.resolveSupportRecipientEmail();

    // Enqueue email notification to selected recipient
    try {
      await this.notificationsService.sendSupportInquiryEmail(
        inserted.name,
        inserted.email,
        inserted.topic,
        inserted.message,
        inserted.id,
        recipientEmail,
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
