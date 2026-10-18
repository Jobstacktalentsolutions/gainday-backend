import {
  slugifyDomain,
  toCategoryScores,
} from '../submissions/employer-submission.view';
import {
  CategoryKey,
  CategoryKeyScores,
  PassportDomain,
} from './capability-passport.types';
import type { CategoryScores } from '../../db/schema';

export const CATEGORY_KEYS: CategoryKey[] = [
  'problemSolving',
  'judgmentExecution',
  'writtenCommunication',
  'commercialDomainAwareness',
];

export interface AggregatableRow {
  domain: string;
  categoryScores: CategoryScores;
}

/** Composite score after each row, oldest first — rows must already be in that order (this is
 *  just `runningAverage` composed with each row's `capabilityPoints`, cross-domain). */
export function buildHistory(points: number[]): {
  history: number[];
  compositeScore: number;
  compositeDelta: number;
} {
  let sum = 0;
  const history = points.map((point, index) => {
    sum += point;
    return Math.round(sum / (index + 1));
  });
  const compositeScore = history.at(-1) ?? 0;
  const compositeDelta =
    history.length > 1 ? compositeScore - history[history.length - 2] : 0;
  return { history, compositeScore, compositeDelta };
}

/** Groups rows by domain, averaging each domain's capability points down to a 0-100 score. */
export function buildDomainBreakdown<T extends AggregatableRow>(
  rows: T[],
  points: number[],
): PassportDomain[] {
  const byDomain = new Map<string, { count: number; pointsSum: number }>();
  rows.forEach((row, index) => {
    const entry = byDomain.get(row.domain) ?? { count: 0, pointsSum: 0 };
    entry.count += 1;
    entry.pointsSum += points[index];
    byDomain.set(row.domain, entry);
  });
  return [...byDomain.entries()].map(([domain, { count, pointsSum }]) => ({
    id: slugifyDomain(domain),
    name: domain,
    simulationCount: count,
    score: Math.round(pointsSum / count / 10),
  }));
}

/** Average of each of the 4 raw category scores (0-100) across every row, regardless of domain. */
export function buildDimensions<T extends AggregatableRow>(
  rows: T[],
): CategoryKeyScores {
  const sums = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [key, 0]),
  ) as CategoryKeyScores;
  for (const row of rows) {
    const scores = toCategoryScores(row.categoryScores);
    for (const key of CATEGORY_KEYS) {
      sums[key] += scores[key];
    }
  }
  const averages = {} as CategoryKeyScores;
  for (const key of CATEGORY_KEYS) {
    averages[key] = Math.round(sums[key] / rows.length);
  }
  return averages;
}

export function findWeakestCategory(
  dimensions: CategoryKeyScores,
): CategoryKey {
  return CATEGORY_KEYS.reduce((weakest, key) =>
    dimensions[key] < dimensions[weakest] ? key : weakest,
  );
}

export function findWeakestDomain(domains: PassportDomain[]): string {
  if (domains.length === 0) return 'Unspecified';
  return domains.reduce((weakest, domain) =>
    domain.score < weakest.score ? domain : weakest,
  ).name;
}
