import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNotNull, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import {
  submissions,
  jobs,
  jobExtractions,
  CategoryScores,
} from '../../db/schema';
import {
  capabilityDomainSql,
  capabilityPoints,
  toCategoryScores,
} from '../submissions/employer-submission.view';
import {
  buildDimensions,
  buildDomainBreakdown,
  buildHistory,
  findWeakestCategory,
  findWeakestDomain,
} from './capability-passport.util';
import { PassportNarrativeService } from './passport-narrative.service';
import {
  CandidatePassport,
  CapabilityPassportSummary,
} from './capability-passport.types';

/** How many of the candidate's most recent graded submissions feed the narrative LLM call —
 *  kept small deliberately, see PassportNarrativeService. */
const RECENT_SUBMISSIONS_FOR_NARRATIVE = 3;

interface GradedSubmissionRow {
  id: string;
  completedAt: Date;
  overallScore: number | null;
  categoryScores: CategoryScores;
  taskScores: { summary: string }[] | null;
  domain: string;
}

@Injectable()
export class CapabilityPassportService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly passportNarrativeService: PassportNarrativeService,
  ) {}

  /**
   * The candidate's whole graded history, aggregated across every domain they've been scored in
   * (not scoped to one job, unlike SubmissionsService.findCapabilityHistories) — composite
   * score/history, a per-domain breakdown, and (cached, LLM-generated) narrative text. Null when
   * the candidate has no graded submissions yet.
   */
  async getCandidatePassport(
    candidateId: string,
  ): Promise<CandidatePassport | null> {
    const rows = await this.loadGradedSubmissions(candidateId);
    if (rows.length === 0) {
      return null;
    }

    const points = rows.map((row) => capabilityPoints(row.categoryScores));
    const { history, compositeScore, compositeDelta } = buildHistory(
      rows,
      points,
    );

    const domains = buildDomainBreakdown(rows, points);
    const dimensions = buildDimensions(rows);
    const lastUpdated = rows[rows.length - 1].completedAt.toISOString();

    const recentSubmissions = [...rows]
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
      .slice(0, RECENT_SUBMISSIONS_FOR_NARRATIVE);
    const weakestCategory = findWeakestCategory(dimensions);
    const weakestDomain = findWeakestDomain(domains);

    const narrative = await this.passportNarrativeService.getOrRegenerate(
      candidateId,
      recentSubmissions.map((row) => row.id),
      () => ({
        compositeScore,
        compositeDelta,
        weakestCategory,
        weakestDomain,
        recentSubmissions: recentSubmissions.map((row) => ({
          domain: row.domain,
          overallScore: row.overallScore ?? 0,
          categoryScores: toCategoryScores(row.categoryScores),
          taskSummaries: (row.taskScores ?? []).map((task) => task.summary),
        })),
      }),
    );

    return {
      compositeScore,
      compositeDelta,
      verifiedSimulationCount: rows.length,
      lastUpdated,
      history,
      dimensions,
      domains,
      whatStoodOut: narrative.whatStoodOut,
      improvementSuggestions: narrative.improvementSuggestions,
    };
  }

  /** Same data minus `improvementSuggestions` — candidate-only, never shown to employers. */
  toEmployerSummary(
    passport: CandidatePassport | null,
  ): CapabilityPassportSummary | null {
    if (!passport) return null;
    return {
      compositeScore: passport.compositeScore,
      compositeDelta: passport.compositeDelta,
      verifiedSimulationCount: passport.verifiedSimulationCount,
      lastUpdated: passport.lastUpdated,
      history: passport.history,
      dimensions: passport.dimensions,
      domains: passport.domains,
      whatStoodOut: passport.whatStoodOut,
    };
  }

  private async loadGradedSubmissions(
    candidateId: string,
  ): Promise<GradedSubmissionRow[]> {
    const domainOf = capabilityDomainSql();
    const rows = await this.db
      .select({
        id: submissions.id,
        completedAt: submissions.completedAt,
        overallScore: submissions.overallScore,
        categoryScores: submissions.categoryScores,
        taskScores: submissions.taskScores,
        domain: domainOf,
      })
      .from(submissions)
      .innerJoin(jobs, eq(jobs.id, submissions.jobId))
      .leftJoin(jobExtractions, eq(jobExtractions.jobId, jobs.id))
      .where(
        and(
          eq(submissions.candidateId, candidateId),
          isNotNull(submissions.categoryScores),
          isNotNull(submissions.completedAt),
          ne(submissions.status, 'DISQUALIFIED'),
        ),
      )
      .orderBy(asc(submissions.completedAt));

    return rows as GradedSubmissionRow[];
  }
}
