import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  employerProfiles,
  EmployerProfile,
  NewEmployerProfile,
} from '../../db/schema';

@Injectable()
export class EmployerProfileService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findByUserId(userId: string): Promise<EmployerProfile | null> {
    const [profile] = await this.db
      .select()
      .from(employerProfiles)
      .where(eq(employerProfiles.userId, userId));
    return profile ?? null;
  }

  async findById(profileId: string): Promise<EmployerProfile | null> {
    const [profile] = await this.db
      .select()
      .from(employerProfiles)
      .where(eq(employerProfiles.id, profileId));
    return profile ?? null;
  }

  async create(
    data: NewEmployerProfile,
    tx?: DrizzleDb,
  ): Promise<EmployerProfile> {
    const db = tx ?? this.db;
    const [profile] = await db
      .insert(employerProfiles)
      .values(data)
      .returning();
    return profile;
  }
}
