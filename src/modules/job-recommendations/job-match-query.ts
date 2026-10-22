import { inArray, sql } from 'drizzle-orm';
import type { DrizzleDb } from '../../db/client';
import {
  candidateMatchEmbeddings,
  jobMatchEmbeddings,
  jobSeekerProfiles,
  submissions,
} from '../../db/schema';
import {
  jobRecommendationConfig,
  SelectionRules,
} from '../../config/job-recommendations.config';
import {
  CandidateMatch,
  groupMatchesByCandidate,
} from './job-recommendation.util';

/**
 * Cosine similarity of every eligible candidate against each of the given jobs, keeping each
 * candidate's top `maxPerCandidate` above `minScore`. Candidates who already applied to a job are
 * left out of it. Candidates left with fewer than `minPerCandidate` matches are dropped.
 *
 * `rules` defaults to the configured rules. The preview passes looser ones to see every score.
 * Used by the scheduled pass and by the preview script, so both select matches the same way.
 */
export async function findCandidateMatches(
  db: DrizzleDb,
  jobIds: string[],
  rules: SelectionRules = jobRecommendationConfig,
): Promise<CandidateMatch[]> {
  const { rows } = await db.execute<CandidateMatch>(sql`
    SELECT "candidateId", "jobId", score
    FROM (
      SELECT
        ${candidateMatchEmbeddings.candidateId} AS "candidateId",
        ${jobMatchEmbeddings.jobId} AS "jobId",
        1 - (${candidateMatchEmbeddings.embedding} <=> ${jobMatchEmbeddings.embedding}) AS score,
        ROW_NUMBER() OVER (
          PARTITION BY ${candidateMatchEmbeddings.candidateId}
          ORDER BY ${candidateMatchEmbeddings.embedding} <=> ${jobMatchEmbeddings.embedding}
        ) AS "rank"
      FROM ${candidateMatchEmbeddings}
      INNER JOIN ${jobSeekerProfiles}
        ON ${jobSeekerProfiles.id} = ${candidateMatchEmbeddings.candidateId}
      CROSS JOIN ${jobMatchEmbeddings}
      WHERE ${inArray(jobMatchEmbeddings.jobId, jobIds)}
        AND ${jobSeekerProfiles.isProfileComplete} = true
        AND NOT EXISTS (
          SELECT 1 FROM ${submissions}
          WHERE ${submissions.candidateId} = ${candidateMatchEmbeddings.candidateId}
            AND ${submissions.jobId} = ${jobMatchEmbeddings.jobId}
        )
    ) ranked
    WHERE score >= ${rules.minScore}
      AND "rank" <= ${rules.maxPerCandidate}
  `);

  return [
    ...groupMatchesByCandidate(rows, rules.minPerCandidate).values(),
  ].flat();
}
