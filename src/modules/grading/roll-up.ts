import {
  CategoryScores,
  TaskGradingResult,
} from '../../db/schema/submissions.schema';
import { CategoryWeights } from './roles/anchor-role-config.interface';

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

/**
 * Deterministic (no LLM call) rollup of per-task grading results into the submission-level
 * categoryScores + overallScore. Every score here is a whole number on the same 0-100 scale as
 * the anchors it was graded against, so a category score is directly comparable to any
 * individual task's score; overallScore is the weighted, 0-100
 * scaled summary — the two are intentionally on different scales, matching what the employer/
 * candidate-facing "out of 100" framing already expects (see scoring-results.ejs).
 */
export function rollUpTaskScores(
  taskResults: TaskGradingResult[],
  taskTitleById: Map<string, string>,
  weights: CategoryWeights,
): { categoryScores: CategoryScores; overallScore: number } {
  const categoryScores = {} as CategoryScores;

  for (const key of CATEGORY_KEYS) {
    const scores = taskResults.map((t) => t.categoryScores[key].score);
    const evidence = taskResults
      .map(
        (t) =>
          `${taskTitleById.get(t.taskId) ?? t.taskId}: ${t.categoryScores[key].score}/100`,
      )
      .join('; ');

    categoryScores[key] = {
      score: Math.round(average(scores)),
      rationale: `Average of the per-task ${CATEGORY_LABELS[key]} scores across ${taskResults.length} task(s).`,
      evidence,
    };
  }

  const weightedSum = CATEGORY_KEYS.reduce(
    (sum, key) => sum + categoryScores[key].score * weights[key],
    0,
  );
  // weights sum to 1, so the weighted sum is already on the 0-100 scale.
  const overallScore = Math.round(weightedSum);

  return { categoryScores, overallScore };
}
