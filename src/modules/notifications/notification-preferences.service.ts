import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  notificationPreferences,
  NotificationPreferences,
} from '../../db/schema';
import { chunk } from '../../common/chunk.util';

export const NotificationCategory = {
  JOB_RECOMMENDATIONS: 'JOB_RECOMMENDATIONS',
  NEWSLETTER: 'NEWSLETTER',
} as const;
export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export type PreferenceSettings = Pick<
  NotificationPreferences,
  'jobRecommendationsEnabled' | 'newsletterEnabled'
>;

const CHUNK_SIZE = 500;

const columnByCategory = {
  JOB_RECOMMENDATIONS: notificationPreferences.jobRecommendationsEnabled,
  NEWSLETTER: notificationPreferences.newsletterEnabled,
} as const;

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly configService: ConfigService,
  ) {}

  /**
   * The users in `userIds` who have turned `category` off. Checked before sending, so a user
   * without a row (the default: everything on) is never in the result.
   */
  async optedOutUserIds(
    category: NotificationCategory,
    userIds: string[],
  ): Promise<Set<string>> {
    const column = columnByCategory[category];
    const optedOut = new Set<string>();
    for (const batch of chunk(userIds, CHUNK_SIZE)) {
      const rows = await this.db
        .select({ userId: notificationPreferences.userId })
        .from(notificationPreferences)
        .where(
          and(
            inArray(notificationPreferences.userId, batch),
            eq(column, false),
          ),
        );
      for (const row of rows) {
        optedOut.add(row.userId);
      }
    }
    return optedOut;
  }

  /** Unsubscribe link for a user's emails, creating their preferences row on first use. */
  async getUnsubscribeUrl(userId: string): Promise<string> {
    const preferences = await this.getOrCreate(userId);
    const appUrl = this.configService.get<string>('email.appUrl');
    return `${appUrl}/email-preferences?token=${preferences.unsubscribeToken}`;
  }

  async findByToken(token: string): Promise<PreferenceSettings> {
    const preferences = await this.selectByToken(token);
    return this.toSettings(preferences);
  }

  async updateByToken(
    token: string,
    changes: Partial<PreferenceSettings>,
  ): Promise<PreferenceSettings> {
    const [updated] = await this.db
      .update(notificationPreferences)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(notificationPreferences.unsubscribeToken, token))
      .returning();
    if (!updated) {
      throw new NotFoundException('This link is no longer valid');
    }
    return this.toSettings(updated);
  }

  private async getOrCreate(userId: string): Promise<NotificationPreferences> {
    await this.db
      .insert(notificationPreferences)
      .values({ userId, unsubscribeToken: randomBytes(32).toString('hex') })
      .onConflictDoNothing({ target: notificationPreferences.userId });

    const [preferences] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    if (!preferences) {
      throw new Error(`Notification preferences missing for user ${userId}`);
    }
    return preferences;
  }

  private async selectByToken(token: string): Promise<NotificationPreferences> {
    const [preferences] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.unsubscribeToken, token));
    if (!preferences) {
      throw new NotFoundException('This link is no longer valid');
    }
    return preferences;
  }

  private toSettings(preferences: NotificationPreferences): PreferenceSettings {
    return {
      jobRecommendationsEnabled: preferences.jobRecommendationsEnabled,
      newsletterEnabled: preferences.newsletterEnabled,
    };
  }
}
