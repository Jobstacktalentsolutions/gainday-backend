import {
  BOARD_RECENCY_HALF_LIFE_DAYS,
  rankJobIds,
  RankableJob,
} from './job-board-ranking';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const job = (id: string, liveDaysAgo: number): RankableJob => ({
  id,
  activatedAt: daysAgo(liveDaysAgo),
  createdAt: daysAgo(liveDaysAgo),
});

describe('rankJobIds', () => {
  it('ranks newer jobs first when there are no similarities (guest)', () => {
    const jobs = [job('old', 60), job('new', 1), job('mid', 10)];
    expect(rankJobIds(jobs, new Map(), NOW)).toEqual(['new', 'mid', 'old']);
  });

  it('lets a closer title match outrank a newer job', () => {
    const jobs = [job('new', 1), job('matching', 60)];
    const similarities = new Map([
      ['new', 0.2],
      ['matching', 0.9],
    ]);
    expect(rankJobIds(jobs, similarities, NOW)[0]).toBe('matching');
  });

  it('treats a job with no similarity as 0 once similarities are known', () => {
    const jobs = [job('unscored', 0), job('scored', 0)];
    const similarities = new Map([['scored', 0.5]]);
    expect(rankJobIds(jobs, similarities, NOW)).toEqual(['scored', 'unscored']);
  });

  it('halves the recency score after one half-life', () => {
    const jobs = [job('fresh', 0), job('half', BOARD_RECENCY_HALF_LIFE_DAYS)];
    expect(rankJobIds(jobs, new Map(), NOW)).toEqual(['fresh', 'half']);
  });
});
