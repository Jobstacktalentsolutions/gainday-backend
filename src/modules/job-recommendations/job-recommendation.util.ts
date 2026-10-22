import { createHash } from 'crypto';
import type { Job } from '../../db/schema';

// Keeps a job description under the embedding model's input limit (roughly 2,000 tokens).
const JOB_MATCH_TEXT_MAX_CHARS = 6000;

export type CandidateMatch = {
  candidateId: string;
  jobId: string;
  score: number;
};

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function buildCandidateMatchText(
  title: string,
  brief: string | null,
): string {
  return brief ? `${title}\n${brief}` : title;
}

export function buildJobMatchText(
  job: Pick<
    Job,
    'title' | 'role' | 'requiredSkills' | 'businessProblem' | 'description'
  >,
): string {
  return [
    job.title,
    job.role,
    job.requiredSkills.join(', '),
    job.businessProblem,
    job.description,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, JOB_MATCH_TEXT_MAX_CHARS);
}

/**
 * Keeps each candidate's matches only when there are at least `min` of them, so a candidate with
 * a single weak match gets nothing. Input is expected to be already capped at the maximum per
 * candidate by the query. Returns the matches grouped by candidate.
 */
export function groupMatchesByCandidate(
  matches: CandidateMatch[],
  min: number,
): Map<string, CandidateMatch[]> {
  const grouped = new Map<string, CandidateMatch[]>();
  for (const match of matches) {
    const existing = grouped.get(match.candidateId);
    if (existing) {
      existing.push(match);
    } else {
      grouped.set(match.candidateId, [match]);
    }
  }
  for (const [candidateId, candidateMatches] of grouped) {
    if (candidateMatches.length < min) {
      grouped.delete(candidateId);
    }
  }
  return grouped;
}
