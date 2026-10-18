import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  jobSeekerProfiles,
  JobSeekerProfile,
  NewJobSeekerProfile,
  CapabilityScores,
  PassportNarrative,
} from '../../db/schema';

@Injectable()
export class JobSeekerProfileService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findByUserId(userId: string): Promise<JobSeekerProfile | null> {
    const [profile] = await this.db
      .select()
      .from(jobSeekerProfiles)
      .where(eq(jobSeekerProfiles.userId, userId));
    return profile ?? null;
  }

  async findById(profileId: string): Promise<JobSeekerProfile | null> {
    const [profile] = await this.db
      .select()
      .from(jobSeekerProfiles)
      .where(eq(jobSeekerProfiles.id, profileId));
    return profile ?? null;
  }

  async create(
    data: NewJobSeekerProfile,
    tx?: DrizzleDb,
  ): Promise<JobSeekerProfile> {
    const db = tx ?? this.db;
    const [profile] = await db
      .insert(jobSeekerProfiles)
      .values(data)
      .returning();
    return profile;
  }

  async updateCapabilityScores(
    profileId: string,
    domain: string,
    scoreDetails: any,
  ): Promise<JobSeekerProfile> {
    const [existing] = await this.db
      .select()
      .from(jobSeekerProfiles)
      .where(eq(jobSeekerProfiles.id, profileId));
    if (!existing) {
      throw new Error('Job seeker profile not found');
    }

    const scores: CapabilityScores = existing.capabilityScores || {};
    scores[domain] = {
      score: scoreDetails.score,
      updatedAt: new Date().toISOString(),
      categories: scoreDetails.categories,
    };

    const [updated] = await this.db
      .update(jobSeekerProfiles)
      .set({ capabilityScores: scores, updatedAt: new Date() })
      .where(eq(jobSeekerProfiles.id, profileId))
      .returning();

    return updated;
  }

  /** `isProfileComplete` is derived here, not accepted from the caller: the profile counts as
   *  complete once `pronouns` — the only field candidates are required to fill — is set. */
  async update(
    profileId: string,
    data: Partial<
      Pick<
        JobSeekerProfile,
        'fullName' | 'phoneNumber' | 'gender' | 'pronouns' | 'brief'
      >
    >,
  ): Promise<JobSeekerProfile> {
    const existing = await this.findById(profileId);
    if (!existing) {
      throw new Error('Job seeker profile not found');
    }

    const pronouns =
      data.pronouns !== undefined ? data.pronouns : existing.pronouns;
    const [updated] = await this.db
      .update(jobSeekerProfiles)
      .set({
        ...data,
        isProfileComplete: pronouns !== null,
        updatedAt: new Date(),
      })
      .where(eq(jobSeekerProfiles.id, profileId))
      .returning();
    return updated;
  }

  /** Null when no narrative has ever been generated for this candidate — see
   *  PassportNarrativeService for the staleness check against `basedOnSubmissionIds`. */
  async getPassportNarrative(
    profileId: string,
  ): Promise<PassportNarrative | null> {
    const [profile] = await this.db
      .select({ passportNarrative: jobSeekerProfiles.passportNarrative })
      .from(jobSeekerProfiles)
      .where(eq(jobSeekerProfiles.id, profileId));
    return profile?.passportNarrative ?? null;
  }

  async setPassportNarrative(
    profileId: string,
    narrative: PassportNarrative,
  ): Promise<void> {
    await this.db
      .update(jobSeekerProfiles)
      .set({ passportNarrative: narrative, updatedAt: new Date() })
      .where(eq(jobSeekerProfiles.id, profileId));
  }
}
