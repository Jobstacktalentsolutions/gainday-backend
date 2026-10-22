import {
  buildCandidateMatchText,
  buildJobMatchText,
  chunk,
  groupMatchesByCandidate,
  hashText,
} from './job-recommendation.util';

describe('groupMatchesByCandidate', () => {
  const match = (candidateId: string, jobId: string) => ({
    candidateId,
    jobId,
    score: 0.9,
  });

  it('keeps a candidate who has at least the minimum number of matches', () => {
    const grouped = groupMatchesByCandidate(
      [match('c1', 'j1'), match('c1', 'j2')],
      2,
    );
    expect([...grouped.keys()]).toEqual(['c1']);
    expect(grouped.get('c1')).toHaveLength(2);
  });

  it('drops a candidate with fewer matches than the minimum', () => {
    const grouped = groupMatchesByCandidate(
      [match('c1', 'j1'), match('c2', 'j1'), match('c2', 'j2')],
      2,
    );
    expect([...grouped.keys()]).toEqual(['c2']);
  });

  it('returns nothing when no candidate reaches the minimum', () => {
    expect(groupMatchesByCandidate([match('c1', 'j1')], 2).size).toBe(0);
  });
});

describe('chunk', () => {
  it('splits items into batches of the given size, keeping the remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no batches for an empty list', () => {
    expect(chunk([], 2)).toEqual([]);
  });
});

describe('hashText', () => {
  it('is stable for the same text and differs when the text changes', () => {
    expect(hashText('Product Manager')).toBe(hashText('Product Manager'));
    expect(hashText('Product Manager')).not.toBe(hashText('Product Designer'));
  });
});

describe('buildCandidateMatchText', () => {
  it('uses the title alone when there is no brief', () => {
    expect(buildCandidateMatchText('Product Manager', null)).toBe(
      'Product Manager',
    );
  });

  it('appends the brief under the title', () => {
    expect(
      buildCandidateMatchText('Product Manager', 'Fintech background'),
    ).toBe('Product Manager\nFintech background');
  });
});

describe('buildJobMatchText', () => {
  it('joins the job fields and leaves out the empty ones', () => {
    expect(
      buildJobMatchText({
        title: 'Growth Analyst',
        role: null,
        requiredSkills: ['SQL', 'Excel'],
        businessProblem: null,
        description: 'Own the weekly funnel review.',
      }),
    ).toBe('Growth Analyst\nSQL, Excel\nOwn the weekly funnel review.');
  });

  it('caps very long descriptions to stay within the embedding input limit', () => {
    const text = buildJobMatchText({
      title: 'Engineer',
      role: null,
      requiredSkills: [],
      businessProblem: null,
      description: 'x'.repeat(10_000),
    });
    expect(text.length).toBeLessThanOrEqual(6000);
  });
});
