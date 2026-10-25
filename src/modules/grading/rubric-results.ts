import type { TaskRubric } from '../../db/schema/question-bank.schema';
import type { TaskGradingResult } from '../../db/schema/submissions.schema';
import type { LlmRubricResult } from './schemas/task-grading-result.schema';
import type { GateOutcome } from './task-category-scores';

/**
 * Pairs the grader's checklist marks with the task's own checklist text, so the stored result
 * names each item from the task rather than from the model. Fails when the marks do not line up.
 */
export function checklistResults(
  rubric: TaskRubric | undefined,
  llm: LlmRubricResult,
): TaskGradingResult['checklist'] {
  if (!rubric || rubric.checklist.length === 0) return undefined;
  const marks = llm.checklist;
  if (!marks || marks.length !== rubric.checklist.length) {
    throw new Error(
      `The grader returned ${marks ? marks.length : 0} checklist mark(s) for ${rubric.checklist.length} item(s)`,
    );
  }
  return rubric.checklist.map((item, index) => ({
    item,
    met: marks[index].met,
    evidence: marks[index].evidence,
  }));
}

/** The gate outcome for this task, or null when the task has no gate. */
export function gateOutcome(
  rubric: TaskRubric | undefined,
  llm: LlmRubricResult,
): GateOutcome | null {
  if (!rubric || rubric.gate === null) return null;
  if (llm.gateTriggered === undefined) {
    throw new Error('The grader returned no gate result for a task that has a gate');
  }
  return { triggered: llm.gateTriggered, description: rubric.gate };
}
