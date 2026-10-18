import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  candidateNotifications,
  CandidateNotification,
  CandidateNotificationType,
} from '../../db/schema';
import { NotificationsService } from './notifications.service';

export interface CandidateSelectedInput {
  candidateId: string;
  candidateEmail: string;
  candidateName: string;
  submissionId: string;
  jobId: string;
  jobTitle: string;
  companyName: string | null;
}

// The bell shows the latest notifications only; there is no history page to page through.
const LIST_LIMIT = 30;

@Injectable()
export class CandidateNotificationsService {
  private readonly logger = new Logger(CandidateNotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Stores the in-app notification and emails the candidate. The email is best-effort: a
   *  failure to send it is logged and never fails the notification itself. */
  async notifySelected(input: CandidateSelectedInput): Promise<void> {
    const employer = input.companyName ?? 'The hiring team';
    await this.db.insert(candidateNotifications).values({
      candidateId: input.candidateId,
      type: CandidateNotificationType.SELECTED,
      title: `You've been selected for ${input.jobTitle}`,
      message: `${employer} selected you for ${input.jobTitle}. Congratulations!`,
      metadata: { submissionId: input.submissionId, jobId: input.jobId },
    });

    try {
      await this.notificationsService.sendCandidateSelectedEmail(
        input.candidateEmail,
        {
          candidateName: input.candidateName,
          jobTitle: input.jobTitle,
          companyName: input.companyName,
          submissionId: input.submissionId,
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to email candidate ${input.candidateId} about being selected`,
        err,
      );
    }
  }

  list(candidateId: string): Promise<CandidateNotification[]> {
    return this.db
      .select()
      .from(candidateNotifications)
      .where(eq(candidateNotifications.candidateId, candidateId))
      .orderBy(desc(candidateNotifications.createdAt))
      .limit(LIST_LIMIT);
  }

  async hasUnread(candidateId: string): Promise<{ hasUnread: boolean }> {
    const [unread] = await this.db
      .select({ id: candidateNotifications.id })
      .from(candidateNotifications)
      .where(
        and(
          eq(candidateNotifications.candidateId, candidateId),
          isNull(candidateNotifications.readAt),
        ),
      )
      .limit(1);
    return { hasUnread: unread !== undefined };
  }

  async markRead(
    id: string,
    candidateId: string,
  ): Promise<CandidateNotification> {
    const owned = and(
      eq(candidateNotifications.id, id),
      eq(candidateNotifications.candidateId, candidateId),
    );
    const [updated] = await this.db
      .update(candidateNotifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(and(owned, isNull(candidateNotifications.readAt)))
      .returning();
    if (updated) return updated;

    // Either already read (fine, idempotent) or not theirs / nonexistent.
    const [existing] = await this.db
      .select()
      .from(candidateNotifications)
      .where(owned);
    if (!existing) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    return existing;
  }

  async markAllRead(candidateId: string): Promise<{ updated: number }> {
    const rows = await this.db
      .update(candidateNotifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(candidateNotifications.candidateId, candidateId),
          isNull(candidateNotifications.readAt),
        ),
      )
      .returning({ id: candidateNotifications.id });
    return { updated: rows.length };
  }
}
