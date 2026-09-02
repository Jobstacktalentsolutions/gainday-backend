import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { adminProfiles, AdminProfile, NewAdminProfile } from '../../db/schema';

@Injectable()
export class AdminProfileService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findByUserId(userId: string): Promise<AdminProfile | null> {
    const [profile] = await this.db
      .select()
      .from(adminProfiles)
      .where(eq(adminProfiles.userId, userId));
    return profile ?? null;
  }

  async findById(profileId: string): Promise<AdminProfile | null> {
    const [profile] = await this.db
      .select()
      .from(adminProfiles)
      .where(eq(adminProfiles.id, profileId));
    return profile ?? null;
  }

  async create(data: NewAdminProfile, tx?: DrizzleDb): Promise<AdminProfile> {
    const db = tx ?? this.db;
    const [profile] = await db.insert(adminProfiles).values(data).returning();
    return profile;
  }
}
