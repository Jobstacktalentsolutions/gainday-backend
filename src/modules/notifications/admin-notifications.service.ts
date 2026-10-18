import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  adminNotifications,
  AdminNotification,
  AdminNotificationSeverity,
  UserRole,
  users,
} from '../../db/schema';
import type { PaginatedResponse } from '../admin/admin.service';
import { NotificationsService } from './notifications.service';

export interface CreateAdminNotificationInput {
  severity: AdminNotificationSeverity;
  type: string;
  title: string;
  message: string;
  details?: string;
  metadata?: Record<string, string>;
}

export interface ListAdminNotificationsQuery {
  page?: number;
  limit?: number;
  severity?: AdminNotificationSeverity;
  unreadOnly?: boolean;
}

// Provider errors can be very long; the notification only needs enough to diagnose.
const MAX_DETAILS_LENGTH = 2000;

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Stores the notification and, for CRITICAL ones, also emails every active admin. The email
   *  is best-effort: a failure to send it is logged and never fails the notification itself. */
  async create(
    input: CreateAdminNotificationInput,
  ): Promise<AdminNotification> {
    const [notification] = await this.db
      .insert(adminNotifications)
      .values({
        severity: input.severity,
        type: input.type,
        title: input.title,
        message: input.message,
        details: input.details?.slice(0, MAX_DETAILS_LENGTH),
        metadata: input.metadata,
      })
      .returning();

    if (notification.severity === AdminNotificationSeverity.CRITICAL) {
      await this.emailAdmins(notification);
    }
    return notification;
  }

  async list(
    query: ListAdminNotificationsQuery = {},
  ): Promise<PaginatedResponse<AdminNotification>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));

    const conditions = [];
    if (query.severity) {
      conditions.push(eq(adminNotifications.severity, query.severity));
    }
    if (query.unreadOnly) {
      conditions.push(isNull(adminNotifications.readAt));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [[{ total }], items] = await Promise.all([
      this.db.select({ total: count() }).from(adminNotifications).where(where),
      this.db
        .select()
        .from(adminNotifications)
        .where(where)
        .orderBy(desc(adminNotifications.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getStats(): Promise<{
    total: number;
    unread: number;
    criticalUnread: number;
  }> {
    const unread = isNull(adminNotifications.readAt);
    const [[{ total }], [{ unreadCount }], [{ criticalUnread }]] =
      await Promise.all([
        this.db.select({ total: count() }).from(adminNotifications),
        this.db
          .select({ unreadCount: count() })
          .from(adminNotifications)
          .where(unread),
        this.db
          .select({ criticalUnread: count() })
          .from(adminNotifications)
          .where(
            and(
              unread,
              eq(adminNotifications.severity, AdminNotificationSeverity.CRITICAL),
            ),
          ),
      ]);
    return { total, unread: unreadCount, criticalUnread };
  }

  async markRead(id: string): Promise<AdminNotification> {
    const [updated] = await this.db
      .update(adminNotifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(and(eq(adminNotifications.id, id), isNull(adminNotifications.readAt)))
      .returning();
    if (updated) return updated;

    // Either already read (fine, idempotent) or it does not exist.
    const [existing] = await this.db
      .select()
      .from(adminNotifications)
      .where(eq(adminNotifications.id, id));
    if (!existing) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    return existing;
  }

  async markAllRead(): Promise<{ updated: number }> {
    const rows = await this.db
      .update(adminNotifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(isNull(adminNotifications.readAt))
      .returning({ id: adminNotifications.id });
    return { updated: rows.length };
  }

  private async emailAdmins(notification: AdminNotification): Promise<void> {
    try {
      const admins = await this.db
        .select({ email: users.email })
        .from(users)
        .where(and(eq(users.role, UserRole.ADMIN), eq(users.isActive, true)));

      await Promise.all(
        admins.map((admin) =>
          this.notificationsService.sendAdminCriticalAlertEmail(admin.email, {
            severity: notification.severity,
            title: notification.title,
            message: notification.message,
            details: notification.details,
          }),
        ),
      );
    } catch (err) {
      this.logger.error(
        `Failed to email admins about notification ${notification.id}`,
        err,
      );
    }
  }
}
