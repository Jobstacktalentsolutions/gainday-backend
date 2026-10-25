import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../db/db.constants';
import type { DrizzleDb } from '../../../db/client';
import {
  candidateMatchEmbeddings,
  jobMatchEmbeddings,
  jobs,
  submissions,
} from '../../../db/schema';
import { hashText } from '../../job-recommendations/job-recommendation.util';
import { JobBoardCacheService } from './job-board-cache.service';
import { rankJobIds } from './job-board-ranking';
import { ListJobBoardDto } from './dto/list-job-board.dto';

export const JOB_BOARD_PAGE_SIZE = 12;

// The candidate fields the board ranks and filters on. Null for a guest.
export interface BoardCandidate {
  profileId: string;
  title: string | null;
  brief: string | null;
}

export type BoardJob = Awaited<ReturnType<typeof loadActiveJobs>>[number];

export interface BoardPage {
  items: (BoardJob & { isApplied: boolean })[];
  total: number;
  nextOffset: number | null;
}

// Same fallbacks the job board shows for a missing field, so filters match what is displayed.
const roleCategoryOf = (job: BoardJob) => job.role ?? 'General';
const locationOf = (job: BoardJob) => job.location ?? 'Not set';
const employmentTypeOf = (job: BoardJob) => job.employmentType ?? 'Not set';

function loadActiveJobs(db: DrizzleDb) {
  return db.query.jobs.findMany({
    where: eq(jobs.status, 'ACTIVE'),
    with: { employer: true },
  });
}

function matchesFilters(job: BoardJob, query: ListJobBoardDto): boolean {
  const search = query.search?.trim().toLowerCase() ?? '';
  if (
    search &&
    !(job.title ?? '').toLowerCase().includes(search) &&
    !(job.role ?? '').toLowerCase().includes(search) &&
    !(job.skillCategory ?? '').toLowerCase().includes(search) &&
    !(job.requiredSkills ?? []).some((s) => s.toLowerCase().includes(search))
  ) {
    return false;
  }
  if (query.roleCategory && roleCategoryOf(job) !== query.roleCategory)
    return false;
  if (query.location && locationOf(job) !== query.location) return false;
  if (query.employmentType && employmentTypeOf(job) !== query.employmentType)
    return false;

  // A job's salary range overlaps the requested one.
  const jobMin = job.salaryRange?.min ?? 0;
  const jobMax = job.salaryRange?.max ?? Infinity;
  if (query.salaryMax !== undefined && jobMin >= query.salaryMax) return false;
  if (query.salaryMin !== undefined && jobMax <= query.salaryMin) return false;
  return true;
}

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

@Injectable()
export class JobBoardService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly cache: JobBoardCacheService,
  ) {}

  /**
   * One page of live jobs in board order. Applied jobs go after the rest. The filters and the
   * applied split run on every request, so a new application or a closed job shows straight away;
   * only the ranking itself is cached.
   */
  async listPage(
    candidate: BoardCandidate | null,
    query: ListJobBoardDto,
  ): Promise<BoardPage> {
    const activeJobs = await loadActiveJobs(this.db);
    const rankedIds = await this.rankedIds(candidate, activeJobs);
    const jobsById = new Map(activeJobs.map((job) => [job.id, job]));
    const appliedIds = candidate
      ? await this.appliedJobIds(candidate.profileId)
      : new Set<string>();

    const appliedFilter = query.appliedStatus?.toLowerCase();
    const matching = rankedIds.flatMap((id) => {
      const job = jobsById.get(id);
      if (!job || !matchesFilters(job, query)) return [];
      const isApplied = appliedIds.has(job.id);
      if (appliedFilter === 'applied' && !isApplied) return [];
      if (
        (appliedFilter === 'not-applied' || appliedFilter === 'not_applied') &&
        isApplied
      )
        return [];
      return [job];
    });
    const ordered = [
      ...matching.filter((job) => !appliedIds.has(job.id)),
      ...matching.filter((job) => appliedIds.has(job.id)),
    ];

    const offset = query.offset ?? 0;
    const limit = query.limit ?? JOB_BOARD_PAGE_SIZE;
    const end = offset + limit;
    return {
      items: ordered
        .slice(offset, end)
        .map((job) => ({ ...job, isApplied: appliedIds.has(job.id) })),
      total: ordered.length,
      nextOffset: end < ordered.length ? end : null,
    };
  }

  /** The values the filter dropdowns offer, from every live job. */
  async filterOptions() {
    const activeJobs = await loadActiveJobs(this.db);
    return {
      totalActive: activeJobs.length,
      roleCategory: uniqueSorted(activeJobs.map(roleCategoryOf)),
      location: uniqueSorted(activeJobs.map(locationOf)),
      employmentType: uniqueSorted(activeJobs.map(employmentTypeOf)),
    };
  }

  // Job ids ranked best first, from the cache when every live job is in it.
  private async rankedIds(
    candidate: BoardCandidate | null,
    activeJobs: BoardJob[],
  ): Promise<string[]> {
    const viewerKey = candidate
      ? `candidate:${candidate.profileId}:${hashText(JSON.stringify([candidate.title, candidate.brief]))}`
      : 'guest';

    const cached = await this.cache.getRanking(viewerKey);
    if (cached) {
      const cachedIds = new Set(cached);
      if (activeJobs.every((job) => cachedIds.has(job.id))) return cached;
    }

    const similarities = candidate?.title
      ? await this.similaritiesFor(candidate.profileId)
      : new Map<string, number>();
    const ids = rankJobIds(activeJobs, similarities, new Date());

    // A candidate whose embedding does not exist yet is ranked by recency alone. That ranking is
    // not cached, so it is replaced as soon as the embedding is there.
    if (!candidate || similarities.size > 0) {
      await this.cache.setRanking(viewerKey, ids);
    }
    return ids;
  }

  private async similaritiesFor(
    profileId: string,
  ): Promise<Map<string, number>> {
    const { rows } = await this.db.execute<{
      jobId: string;
      score: number;
    }>(sql`
      SELECT ${jobMatchEmbeddings.jobId} AS "jobId",
             1 - (${candidateMatchEmbeddings.embedding} <=> ${jobMatchEmbeddings.embedding}) AS score
      FROM ${candidateMatchEmbeddings}
      CROSS JOIN ${jobMatchEmbeddings}
      WHERE ${candidateMatchEmbeddings.candidateId} = ${profileId}
    `);
    return new Map(rows.map((row) => [row.jobId, row.score]));
  }

  private async appliedJobIds(profileId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ jobId: submissions.jobId })
      .from(submissions)
      .where(
        and(
          eq(submissions.candidateId, profileId),
          isNotNull(submissions.completedAt),
        ),
      );
    return new Set(rows.map((row) => row.jobId));
  }
}
