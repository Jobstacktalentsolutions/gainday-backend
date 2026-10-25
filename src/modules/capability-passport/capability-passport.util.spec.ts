import {
  buildDimensions,
  buildDomainBreakdown,
  buildHistory,
  findWeakestCategory,
  findWeakestDomain,
} from './capability-passport.util';
import { CAPABILITY_HALF_LIFE_DAYS } from '../submissions/employer-submission.view';
import type { CategoryScores } from '../../db/schema';

const categoryScores = (
  problemSolving: number,
  judgmentExecution: number,
  writtenCommunication: number,
  commercialDomainAwareness: number,
): CategoryScores => ({
  problemSolving: { score: problemSolving, rationale: '', evidence: '' },
  judgmentExecution: { score: judgmentExecution, rationale: '', evidence: '' },
  writtenCommunication: {
    score: writtenCommunication,
    rationale: '',
    evidence: '',
  },
  commercialDomainAwareness: {
    score: commercialDomainAwareness,
    rationale: '',
    evidence: '',
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;
const completedOn = (days: number) => ({
  completedAt: new Date(Date.UTC(2026, 0, 1) + days * DAY_MS),
});

describe('buildHistory', () => {
  it('derives compositeScore/compositeDelta from the capability score history', () => {
    const rows = [completedOn(0), completedOn(0), completedOn(0)];
    const { history, compositeScore, compositeDelta } = buildHistory(
      rows,
      [600, 800, 700],
    );
    expect(history).toEqual([533, 600, 620]);
    expect(compositeScore).toBe(620);
    expect(compositeDelta).toBe(20);
  });

  it('compositeDelta is 0 with fewer than 2 points', () => {
    expect(buildHistory([completedOn(0)], [500]).compositeDelta).toBe(0);
    expect(buildHistory([], []).compositeScore).toBe(0);
  });

  it('compositeDelta reflects the most recent movement, not the whole trend', () => {
    const rows = [completedOn(0), completedOn(CAPABILITY_HALF_LIFE_DAYS)];
    const { history, compositeDelta } = buildHistory(rows, [400, 1000]);
    // history: [467, 629] -> delta = 629 - 467 = 162
    expect(history).toEqual([467, 629]);
    expect(compositeDelta).toBe(162);
  });
});

describe('buildDomainBreakdown', () => {
  it('groups rows by domain and averages capability points into a 0-100 score', () => {
    const rows = [
      {
        domain: 'Custody & Settlement',
        categoryScores: categoryScores(80, 80, 80, 50),
      },
      {
        domain: 'Custody & Settlement',
        categoryScores: categoryScores(60, 60, 60, 50),
      },
      {
        domain: 'Risk Management',
        categoryScores: categoryScores(90, 90, 90, 50),
      },
    ];
    // capabilityPoints = round(avg(3 categories) * 10): row1=800, row2=600, row3=900
    const points = [800, 600, 900];
    const domains = buildDomainBreakdown(rows, points);

    expect(domains).toHaveLength(2);
    const custody = domains.find((d) => d.name === 'Custody & Settlement');
    const risk = domains.find((d) => d.name === 'Risk Management');
    expect(custody).toEqual({
      id: 'custody-settlement',
      name: 'Custody & Settlement',
      simulationCount: 2,
      score: 70, // avg(800,600)/10
    });
    expect(risk).toEqual({
      id: 'risk-management',
      name: 'Risk Management',
      simulationCount: 1,
      score: 90,
    });
  });
});

describe('buildDimensions', () => {
  it('averages each of the 4 raw category scores across all rows regardless of domain', () => {
    const rows = [
      { domain: 'A', categoryScores: categoryScores(80, 70, 60, 50) },
      { domain: 'B', categoryScores: categoryScores(60, 50, 40, 30) },
    ];
    expect(buildDimensions(rows)).toEqual({
      problemSolving: 70,
      judgmentExecution: 60,
      writtenCommunication: 50,
      commercialDomainAwareness: 40,
    });
  });
});

describe('findWeakestCategory / findWeakestDomain', () => {
  it('picks the lowest-scoring category', () => {
    expect(
      findWeakestCategory({
        problemSolving: 80,
        judgmentExecution: 60,
        writtenCommunication: 90,
        commercialDomainAwareness: 70,
      }),
    ).toBe('judgmentExecution');
  });

  it('picks the lowest-scoring domain, or "Unspecified" with none', () => {
    expect(
      findWeakestDomain([
        { id: 'a', name: 'A', simulationCount: 1, score: 80 },
        { id: 'b', name: 'B', simulationCount: 1, score: 55 },
      ]),
    ).toBe('B');
    expect(findWeakestDomain([])).toBe('Unspecified');
  });
});
