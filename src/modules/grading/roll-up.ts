import {
  CategoryScores,
  TaskGradingResult,
} from '../../db/schema/submissions.schema';
import { GradingConfig } from './grading.config.interface';

const CATEGORY_KEYS = [
  'problemSolving',
  'judgmentExecution',
  'writtenCommunication',
  'commercialDomainAwareness',
] as const;

const CATEGORY_LABELS: Record<(typeof CATEGORY_KEYS)[number], string> = {
  problemSolving: 'problem-solving',
  judgmentExecution: 'judgment/execution',
  writtenCommunication: 'written communication',
  commercialDomainAwareness: 'commercial/domain awareness',
};

function average(nums: number[]): number {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Deterministic (no LLM call) rollup of per-task grading results into the submission-level
 * categoryScores + overallScore. Each per-task categoryScores.*.score is on the same 0-10 scale
 * as the anchors it was graded against; categoryScores here stays on that 0-10 scale (so it's
 * directly comparable to any individual task's score), while overallScore is a weighted, 0-100
 * scaled summary — the two are intentionally on different scales, matching what the employer/
 * candidate-facing "out of 100" framing already expects (see scoring-results.ejs).
 */
export function rollUpTaskScores(
  taskResults: TaskGradingResult[],
  taskTitleById: Map<string, string>,
  weights: GradingConfig['categoryWeights'],
): { categoryScores: CategoryScores; overallScore: number } {
  const categoryScores = {} as CategoryScores;

  for (const key of CATEGORY_KEYS) {
    const scores = taskResults.map((t) => t.categoryScores[key].score);
    const evidence = taskResults
      .map(
        (t) =>
          `${taskTitleById.get(t.taskId) ?? t.taskId}: ${t.categoryScores[key].score}/10`,
      )
      .join('; ');

    categoryScores[key] = {
      score: round2(average(scores)),
      rationale: `Average of the per-task ${CATEGORY_LABELS[key]} scores across ${taskResults.length} task(s).`,
      evidence,
    };
  }

  const weightedSum = CATEGORY_KEYS.reduce(
    (sum, key) => sum + categoryScores[key].score * weights[key],
    0,
  );
  // weightedSum is on the 0-10 scale (weights sum to 1) — scale to 0-100 for overallScore.
  const overallScore = round2(weightedSum * 10);

  return { categoryScores, overallScore };
}
