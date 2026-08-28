import { NoveltyMatch } from './novelty-check';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  closestMatch: NoveltyMatch | null;
}

/**
 * pgvector cosine distance is 1 - cosine_similarity, so smaller distance = more similar.
 * `similarityThreshold` is expressed as a similarity value (e.g. 0.92); a match is flagged
 * as a duplicate when its distance falls at or below (1 - similarityThreshold).
 */
export function checkForDuplicate(
  matches: NoveltyMatch[],
  similarityThreshold: number,
): DuplicateCheckResult {
  if (matches.length === 0) {
    return { isDuplicate: false, closestMatch: null };
  }

  const closestMatch = matches[0];
  const maxDuplicateDistance = 1 - similarityThreshold;

  return {
    isDuplicate: closestMatch.distance <= maxDuplicateDistance,
    closestMatch,
  };
}
