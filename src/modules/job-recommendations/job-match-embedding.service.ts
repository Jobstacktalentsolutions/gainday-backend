import { Inject, Injectable } from '@nestjs/common';
import { Embeddings } from '@langchain/core/embeddings';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  candidateMatchEmbeddings,
  jobMatchEmbeddings,
  jobSeekerProfiles,
  jobs,
} from '../../db/schema';
import { EMBEDDINGS } from '../ai/ai.constants';
import { chunk } from '../../common/chunk.util';
import {
  buildCandidateMatchText,
  buildJobMatchText,
  hashText,
} from './job-recommendation.util';

const EMBED_BATCH_SIZE = 100;
const WRITE_BATCH_SIZE = 500;

interface MatchTextItem {
  id: string;
  text: string;
}

interface EmbeddedItem {
  id: string;
  contentHash: string;
  embedding: number[];
}

/**
 * Keeps the candidate and job match vectors current. Only items whose match text changed since
 * they were last embedded are sent to the embedding model, so a run costs one call per edited
 * title, brief or job rather than one per candidate.
 */
@Injectable()
export class JobMatchEmbeddingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(EMBEDDINGS) private readonly embeddings: Embeddings,
  ) {}

  /** Embeds every candidate who can receive recommendations: complete profile and a title. */
  async syncCandidates(): Promise<void> {
    const profiles = await this.db
      .select({
        id: jobSeekerProfiles.id,
        title: jobSeekerProfiles.title,
        brief: jobSeekerProfiles.brief,
      })
      .from(jobSeekerProfiles)
      .where(
        and(
          eq(jobSeekerProfiles.isProfileComplete, true),
          isNotNull(jobSeekerProfiles.title),
        ),
      );

    const items = profiles.flatMap((profile) =>
      profile.title
        ? [
            {
              id: profile.id,
              text: buildCandidateMatchText(profile.title, profile.brief),
            },
          ]
        : [],
    );
    const stored = await this.db
      .select({
        candidateId: candidateMatchEmbeddings.candidateId,
        contentHash: candidateMatchEmbeddings.contentHash,
      })
      .from(candidateMatchEmbeddings);
    const storedHashes = new Map(
      stored.map((row) => [row.candidateId, row.contentHash]),
    );

    const embedded = await this.embedStale(items, storedHashes);
    for (const batch of chunk(embedded, WRITE_BATCH_SIZE)) {
      await this.db
        .insert(candidateMatchEmbeddings)
        .values(
          batch.map((item) => ({
            candidateId: item.id,
            contentHash: item.contentHash,
            embedding: item.embedding,
          })),
        )
        .onConflictDoUpdate({
          target: candidateMatchEmbeddings.candidateId,
          set: {
            embedding: sql`excluded.embedding`,
            contentHash: sql`excluded.content_hash`,
            updatedAt: new Date(),
          },
        });
    }
  }

  /** Embeds the given jobs. Jobs without a title are skipped: there is nothing to match on. */
  async syncJobs(jobIds: string[]): Promise<void> {
    const rows = await this.db
      .select({
        id: jobs.id,
        title: jobs.title,
        role: jobs.role,
        requiredSkills: jobs.requiredSkills,
        businessProblem: jobs.businessProblem,
        description: jobs.description,
      })
      .from(jobs)
      .where(inArray(jobs.id, jobIds));

    const items = rows.flatMap((job) =>
      job.title ? [{ id: job.id, text: buildJobMatchText(job) }] : [],
    );
    const stored = await this.db
      .select({
        jobId: jobMatchEmbeddings.jobId,
        contentHash: jobMatchEmbeddings.contentHash,
      })
      .from(jobMatchEmbeddings)
      .where(inArray(jobMatchEmbeddings.jobId, jobIds));
    const storedHashes = new Map(
      stored.map((row) => [row.jobId, row.contentHash]),
    );

    const embedded = await this.embedStale(items, storedHashes);
    for (const batch of chunk(embedded, WRITE_BATCH_SIZE)) {
      await this.db
        .insert(jobMatchEmbeddings)
        .values(
          batch.map((item) => ({
            jobId: item.id,
            contentHash: item.contentHash,
            embedding: item.embedding,
          })),
        )
        .onConflictDoUpdate({
          target: jobMatchEmbeddings.jobId,
          set: {
            embedding: sql`excluded.embedding`,
            contentHash: sql`excluded.content_hash`,
            updatedAt: new Date(),
          },
        });
    }
  }

  /** Returns only the items whose stored hash differs from their current text, embedded. */
  private async embedStale(
    items: MatchTextItem[],
    storedHashes: Map<string, string>,
  ): Promise<EmbeddedItem[]> {
    const stale = items
      .map((item) => ({ ...item, contentHash: hashText(item.text) }))
      .filter((item) => storedHashes.get(item.id) !== item.contentHash);

    const vectors: number[][] = [];
    for (const batch of chunk(stale, EMBED_BATCH_SIZE)) {
      vectors.push(
        ...(await this.embeddings.embedDocuments(
          batch.map((item) => item.text),
        )),
      );
    }

    return stale.map((item, i) => ({
      id: item.id,
      contentHash: item.contentHash,
      embedding: vectors[i],
    }));
  }
}
