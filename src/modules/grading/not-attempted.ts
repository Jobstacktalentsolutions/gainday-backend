import type { SimulationTask } from '../../db/schema/simulations.schema';
import type {
  CandidateAnswer,
  CategoryScoreDetail,
  TaskGradingResult,
} from '../../db/schema/submissions.schema';

export const NOT_ATTEMPTED_SUMMARY = 'Not attempted.';

const NOT_ATTEMPTED_DETAIL: CategoryScoreDetail = {
  score: 0,
  rationale: NOT_ATTEMPTED_SUMMARY,
  evidence: 'No response was submitted for this task.',
};

/**
 * True when the candidate gave nothing for the task: no written text and no objective answer
 * (`objectiveResponse` is null when the candidate left it untouched). Such a task scores 0 without
 * calling the grader, so it needs no anchors or LLM call.
 */
export function isNotAttempted(
  answer: Pick<CandidateAnswer, 'textResponse' | 'objectiveResponse'>,
): boolean {
  return answer.textResponse.trim() === '' && answer.objectiveResponse === null;
}

/** The stored result for a task the candidate did not attempt: zero on every criterion. */
export function notAttemptedResult(
  task: Pick<SimulationTask, 'id' | 'rubric'>,
  questionBankId: string,
): TaskGradingResult {
  return {
    taskId: task.id,
    questionBankId,
    categoryScores: {
      problemSolving: NOT_ATTEMPTED_DETAIL,
      judgmentExecution: NOT_ATTEMPTED_DETAIL,
      writtenCommunication: NOT_ATTEMPTED_DETAIL,
      commercialDomainAwareness: NOT_ATTEMPTED_DETAIL,
    },
    summary: NOT_ATTEMPTED_SUMMARY,
    checklist: task.rubric?.checklist.length
      ? task.rubric.checklist.map((item) => ({
          item,
          met: false,
          evidence: NOT_ATTEMPTED_SUMMARY,
        }))
      : undefined,
  };
}
