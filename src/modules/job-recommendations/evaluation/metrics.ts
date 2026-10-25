import { CandidateMatch } from '../job-recommendation.util';

export interface SelectionRules {
  minScore: number;
  maxPerCandidate: number;
  minPerCandidate: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * The production selection rule, applied in memory: keep pairs at or above `minScore`, take each
 * candidate's best `maxPerCandidate`, and drop candidates left with fewer than `minPerCandidate`.
 * Matches what the SQL in JobRecommendationsService.findMatches and groupMatchesByCandidate
 * produce together.
 */
export function selectMatches(
  pairs: CandidateMatch[],
  rules: SelectionRules,
): CandidateMatch[] {
  const byCandidate = new Map<string, CandidateMatch[]>();
  for (const pair of pairs) {
    if (pair.score < rules.minScore) continue;
    const existing = byCandidate.get(pair.candidateId);
    if (existing) {
      existing.push(pair);
    } else {
      byCandidate.set(pair.candidateId, [pair]);
    }
  }

  const selected: CandidateMatch[] = [];
  for (const matches of byCandidate.values()) {
    if (matches.length < rules.minPerCandidate) continue;
    const best = [...matches]
      .sort((x, y) => y.score - x.score)
      .slice(0, rules.maxPerCandidate);
    selected.push(...best);
  }
  return selected;
}

export interface SelectionQuality {
  candidatesNotified: number;
  emitted: number;
  /** Share of emitted recommendations that are correct. */
  precision: number;
  /** Share of all correct pairs that were emitted. */
  recall: number;
}

export function scoreSelection(
  selected: CandidateMatch[],
  isCorrect: (match: CandidateMatch) => boolean,
  totalCorrectPairs: number,
): SelectionQuality {
  const correct = selected.filter(isCorrect).length;
  return {
    candidatesNotified: new Set(selected.map((match) => match.candidateId))
      .size,
    emitted: selected.length,
    precision: selected.length === 0 ? 0 : correct / selected.length,
    recall: totalCorrectPairs === 0 ? 0 : correct / totalCorrectPairs,
  };
}

/** Precision among the top k ranked results, and where the first correct result landed. */
export function rankingQuality(
  relevanceByRank: boolean[],
  k: number,
): { precisionAtK: number; reciprocalRank: number } {
  const topK = relevanceByRank.slice(0, k);
  const hits = topK.filter(Boolean).length;
  const firstHit = relevanceByRank.findIndex(Boolean);
  return {
    precisionAtK: hits / k,
    reciprocalRank: firstHit === -1 ? 0 : 1 / (firstHit + 1),
  };
}

export function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}
