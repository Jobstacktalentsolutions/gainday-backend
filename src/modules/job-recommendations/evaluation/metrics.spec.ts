import {
  cosineSimilarity,
  rankingQuality,
  scoreSelection,
  selectMatches,
} from './metrics';

const RULES = { minScore: 0.7, maxPerCandidate: 4, minPerCandidate: 2 };
const pair = (candidateId: string, jobId: string, score: number) => ({
  candidateId,
  jobId,
  score,
});

describe('cosineSimilarity', () => {
  it('is 1 for identical directions and 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe('selectMatches', () => {
  it('drops pairs below the minimum score', () => {
    const selected = selectMatches(
      [pair('c1', 'j1', 0.9), pair('c1', 'j2', 0.6)],
      RULES,
    );
    // Only one pair survives the threshold, which is below the minimum of two.
    expect(selected).toEqual([]);
  });

  it('keeps at most the best maxPerCandidate matches, best first', () => {
    const pairs = [0.95, 0.9, 0.85, 0.8, 0.75, 0.72].map((score, i) =>
      pair('c1', `j${i}`, score),
    );
    const selected = selectMatches(pairs, RULES);
    expect(selected.map((m) => m.score)).toEqual([0.95, 0.9, 0.85, 0.8]);
  });

  it('gives nothing to a candidate with fewer than the minimum matches', () => {
    const selected = selectMatches(
      [pair('c1', 'j1', 0.9), pair('c1', 'j2', 0.9), pair('c2', 'j1', 0.9)],
      RULES,
    );
    expect(new Set(selected.map((m) => m.candidateId))).toEqual(new Set(['c1']));
  });
});

describe('scoreSelection', () => {
  it('reports precision over emitted pairs and recall over all correct pairs', () => {
    const selected = [pair('c1', 'j1', 0.9), pair('c1', 'j2', 0.8)];
    const quality = scoreSelection(selected, (m) => m.jobId === 'j1', 4);
    expect(quality).toEqual({
      candidatesNotified: 1,
      emitted: 2,
      precision: 0.5,
      recall: 0.25,
    });
  });
});

describe('rankingQuality', () => {
  it('measures precision at k and the reciprocal rank of the first hit', () => {
    expect(rankingQuality([false, true, true, false, false], 4)).toEqual({
      precisionAtK: 0.5,
      reciprocalRank: 0.5,
    });
  });

  it('gives zero reciprocal rank when nothing is correct', () => {
    expect(rankingQuality([false, false], 2).reciprocalRank).toBe(0);
  });
});
