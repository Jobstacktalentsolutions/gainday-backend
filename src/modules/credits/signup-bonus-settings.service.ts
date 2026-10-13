import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { signupBonusSettings, SIGNUP_BONUS_SETTINGS_ID } from '../../db/schema';

export interface SignupBonusConfig {
  enabled: boolean;
  creditAmount: number;
}

const DEFAULT_SETTINGS: SignupBonusConfig = { enabled: false, creditAmount: 0 };

@Injectable()
export class SignupBonusSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /** Disabled with 0 credits until an admin sets it for the first time. */
  async get(): Promise<SignupBonusConfig> {
    const [row] = await this.db
      .select({
        enabled: signupBonusSettings.enabled,
        creditAmount: signupBonusSettings.creditAmount,
      })
      .from(signupBonusSettings)
      .where(eq(signupBonusSettings.id, SIGNUP_BONUS_SETTINGS_ID));
    return row ?? DEFAULT_SETTINGS;
  }

  async update(
    config: SignupBonusConfig,
    updatedByAdminId: string,
  ): Promise<SignupBonusConfig> {
    const [row] = await this.db
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
      })
      .returning({
        enabled: signupBonusSettings.enabled,
        creditAmount: signupBonusSettings.creditAmount,
      });
    return row;
  }
}
