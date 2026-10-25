// Weights for the board ranking. Similarity to the candidate's title matters most; recency
// breaks the rest and pulls newly live jobs up.
export const BOARD_SIMILARITY_WEIGHT = 0.7;
export const BOARD_RECENCY_WEIGHT = 0.3;
// A job's recency score halves every this many days after it went live.
export const BOARD_RECENCY_HALF_LIFE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RankableJob {
  id: string;
  activatedAt: Date | null;
  createdAt: Date;
}

/**
 * Job ids ranked best first. `similarities` maps a job id to the candidate's cosine similarity
 * with it. With no similarities (a guest, or a candidate without an embedding yet) the ranking is
 * by recency alone. A job without a similarity counts as 0 once any are known.
 */
export function rankJobIds(
  jobs: RankableJob[],
  similarities: Map<string, number>,
  now: Date,
): string[] {
  const hasSimilarity = similarities.size > 0;
  return jobs
    .map((job) => {
      const liveSince = job.activatedAt ?? job.createdAt;
      const ageDays = (now.getTime() - liveSince.getTime()) / DAY_MS;
      const recency = 0.5 ** (ageDays / BOARD_RECENCY_HALF_LIFE_DAYS);
      const score = hasSimilarity
        ? BOARD_SIMILARITY_WEIGHT * (similarities.get(job.id) ?? 0) +
          BOARD_RECENCY_WEIGHT * recency
        : recency;
      return { id: job.id, score, liveSince };
    })
    .sort(
      (a, b) =>
        b.score - a.score || b.liveSince.getTime() - a.liveSince.getTime(),
    )
    .map((entry) => entry.id);
}
