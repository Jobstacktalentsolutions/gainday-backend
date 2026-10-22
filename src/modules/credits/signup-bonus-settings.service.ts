import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  adminProfiles,
  signupBonusSettings,
  SIGNUP_BONUS_SETTINGS_ID,
} from '../../db/schema';

export interface SignupBonusConfig {
  enabled: boolean;
  creditAmount: number;
}

export interface SignupBonusSettingsView extends SignupBonusConfig {
  updatedAt: Date | null;
  updatedByName: string | null;
}

const DEFAULT_SETTINGS: SignupBonusSettingsView = {
  enabled: false,
  creditAmount: 0,
  updatedAt: null,
  updatedByName: null,
};

@Injectable()
export class SignupBonusSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /** Disabled with 0 credits until an admin sets it for the first time. */
  async get(): Promise<SignupBonusSettingsView> {
    const [row] = await this.db
      .select({
        enabled: signupBonusSettings.enabled,
        creditAmount: signupBonusSettings.creditAmount,
        updatedAt: signupBonusSettings.updatedAt,
        updatedByName: adminProfiles.fullName,
      })
      .from(signupBonusSettings)
      .leftJoin(
        adminProfiles,
        eq(signupBonusSettings.updatedByAdminId, adminProfiles.id),
      )
      .where(eq(signupBonusSettings.id, SIGNUP_BONUS_SETTINGS_ID));
    return row ?? DEFAULT_SETTINGS;
  }

  async update(
    config: SignupBonusConfig,
    updatedByAdminId: string,
  ): Promise<SignupBonusSettingsView> {
    await this.db
      .insert(signupBonusSettings)
      .values({
        id: SIGNUP_BONUS_SETTINGS_ID,
        enabled: config.enabled,
        creditAmount: config.creditAmount,
        updatedByAdminId,
      })
      .onConflictDoUpdate({
        target: signupBonusSettings.id,
        set: {
          enabled: config.enabled,
          creditAmount: config.creditAmount,
          updatedByAdminId,
          updatedAt: new Date(),
        },
      });
    return this.get();
  }
}
