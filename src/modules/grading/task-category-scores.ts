import {
  CategoryScoreDetail,
  CategoryScores,
} from '../../db/schema/submissions.schema';
import {
  GRADED_CRITERIA,
  GradedCriterion,
  LlmCategoryScores,
} from './schemas/task-grading-result.schema';
import { ObjectiveGradeResult } from './objective/objective-grader';

/** The criteria the answer key settles for a task with a deterministic objective part: problem-
 *  solving and judgment (finance doc Section 6.4). Written communication and commercial awareness
 *  always come from the LLM grader reading the open-ended answer. */
export const OBJECTIVE_SETTLED_CRITERIA: readonly GradedCriterion[] = [
  'problemSolving',
  'judgmentExecution',
];

/** The criteria the LLM grader scores: all four, minus those the answer key settles. */
export function criteriaForLlm(hasObjectiveResult: boolean): readonly GradedCriterion[] {
  return hasObjectiveResult
    ? GRADED_CRITERIA.filter((criterion) => !OBJECTIVE_SETTLED_CRITERIA.includes(criterion))
    : GRADED_CRITERIA;
}

export function describeObjectiveResult(result: ObjectiveGradeResult): string {
  return `${result.correctParts} of ${result.totalParts} parts correct (${result.score}/100)`;
}

function fromLlm(scores: LlmCategoryScores, criterion: GradedCriterion): CategoryScoreDetail {
  const detail = scores[criterion];
  if (!detail) {
    throw new Error(`The grader returned no score for ${criterion}`);
  }
  return detail;
}

/** Judgment is capped at this score when the response does what the task's gate forbids. */
export const GATE_JUDGMENT_CAP = 20;

export interface GateOutcome {
  triggered: boolean;
  /** The forbidden behaviour the gate names, shown in the rationale when it is triggered. */
  description: string;
}

/**
 * Merges a task's category scores: the answer-key result settles the objective criteria when there
 * is one, and the LLM scores everything else. A triggered gate caps judgment, but only where the LLM
 * owns it: an answer key is never overridden.
 */
export function combineCategoryScores(
  llmScores: LlmCategoryScores,
  objective: ObjectiveGradeResult | null,
  gate: GateOutcome | null = null,
): CategoryScores {
  const llm = (criterion: GradedCriterion) => fromLlm(llmScores, criterion);
  if (!objective) {
    const problemSolving = llm('problemSolving');
    const judgment = llm('judgmentExecution');
    return {
      problemSolving,
      judgmentExecution:
        gate?.triggered === true
          ? {
              ...judgment,
              score: Math.min(judgment.score, GATE_JUDGMENT_CAP),
              rationale: `${judgment.rationale} Capped at ${GATE_JUDGMENT_CAP}: the response does what the gate forbids (${gate.description}).`,
            }
          : judgment,
      writtenCommunication: llm('writtenCommunication'),
      commercialDomainAwareness: llm('commercialDomainAwareness'),
    };
  }

  const checked: CategoryScoreDetail = {
    score: objective.score,
    rationale: `Checked against the answer key: ${describeObjectiveResult(objective)}.`,
    evidence: `${objective.correctParts} of ${objective.totalParts} parts match the key.`,
  };
  return {
    problemSolving: checked,
    judgmentExecution: checked,
    writtenCommunication: llm('writtenCommunication'),
    commercialDomainAwareness: llm('commercialDomainAwareness'),
  };
}
