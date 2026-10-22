/**
 * Job recommendation tuning. Change the numbers here, not in the matcher.
 *
 * - minScore: lowest cosine similarity (0-1) a candidate/job pair needs to be recommended.
 *   0.60 was chosen from the offline evaluation (pnpm recs:evaluate) as the best trade-off so far.
 * - maxPerCandidate / minPerCandidate: a candidate gets at most `max` recommendations per pass,
 *   and none at all unless they reach `min`.
 * - cronPattern / timezone: when a pass runs (default: 09:00 and 18:00 UK time).
 */
export interface SelectionRules {
  minScore: number;
  maxPerCandidate: number;
  minPerCandidate: number;
}

export const jobRecommendationConfig = {
  cronPattern: '0 9,18 * * *',
  timezone: 'Europe/London',
  minScore: 0.6,
  maxPerCandidate: 4,
  minPerCandidate: 2,
} satisfies SelectionRules;
