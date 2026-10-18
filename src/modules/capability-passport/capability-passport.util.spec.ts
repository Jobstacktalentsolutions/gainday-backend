import {
  buildDimensions,
  buildDomainBreakdown,
  buildHistory,
  findWeakestCategory,
  findWeakestDomain,
} from './capability-passport.util';
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

describe('buildHistory', () => {
  it('computes a running average and derives compositeScore/compositeDelta from it', () => {
    const { history, compositeScore, compositeDelta } = buildHistory([
      600, 800, 700,
    ]);
    expect(history).toEqual([600, 700, 700]);
    expect(compositeScore).toBe(700);
    expect(compositeDelta).toBe(0);
  });

  it('compositeDelta is 0 with fewer than 2 points', () => {
    expect(buildHistory([500]).compositeDelta).toBe(0);
    expect(buildHistory([]).compositeScore).toBe(0);
  });

  it('compositeDelta reflects the most recent movement, not the whole trend', () => {
    const { compositeDelta } = buildHistory([400, 1000]);
    // running average: [400, 700] -> delta = 700 - 400 = 300
    expect(compositeDelta).toBe(300);
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
