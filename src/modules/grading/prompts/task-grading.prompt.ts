import { generationConfig } from '../../../config/ai.config';
import type { TaskRubric } from '../../../db/schema/question-bank.schema';
import { AnchorCriteriaFraming } from '../roles/anchor-role-config.interface';
import { GradedCriterion } from '../schemas/task-grading-result.schema';

const CRITERION_LABELS: Record<GradedCriterion, string> = {
  problemSolving: 'Problem-solving',
  judgmentExecution: 'Judgment/execution',
  writtenCommunication: 'Written communication',
  commercialDomainAwareness: 'Commercial/domain awareness',
};

function rubricClause(rubric: TaskRubric | undefined): string {
  if (!rubric) return '';
  const checklistPart =
    rubric.checklist.length > 0
      ? '\n\nChecklist: for each item below, in order, set "met" true only if the response does it, and quote evidence ("" when not met):\n' +
        rubric.checklist.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : '';
  const gatePart =
    rubric.gate !== null
      ? `\n\nGate: set "gateTriggered" true only if the response does this: ${rubric.gate}. Otherwise false.`
      : '';
  return checklistPart + gatePart;
}

/**
 * @param verifiedResult Set when the objective part was already checked in code: the model then
 *   scores only `criteria` and must treat that check as settled.
 * @param rubric The task's checklist and gate. The model marks them, and grading uses those marks.
 */
export function buildTaskGradingPrompt(
  criteriaFraming: AnchorCriteriaFraming,
  criteria: readonly GradedCriterion[],
  verifiedResult?: string,
  rubric?: TaskRubric,
): string {
  const criteriaLines = criteria
    .map((criterion) => `- ${CRITERION_LABELS[criterion]}: ${criteriaFraming[criterion]}`)
    .join('\n');
  const verifiedClause = verifiedResult
    ? `\n\nThe figures in this response were already checked against an answer key: ${verifiedResult}. Treat that as settled and do not re-score it; ` +
      'your summary must be consistent with it.'
    : '';

  return `You are grading a candidate's response to a job-simulation task. You are given the task
itself, a set of anchor responses spanning the score range (${generationConfig.anchorScorePoints.join(', ')}) — reference points
showing what a response at each level actually looks like — and the candidate's real submitted
response.

Score the candidate's response on each of these criteria, framed for this role, using a whole
number from 0 to 100 (no decimals) — you are not limited to the anchor points; a response between
two anchors gets a score between them, and one weaker than the lowest anchor (blank, off-topic, or
worse) scores below it, down to 0:
${criteriaLines}${verifiedClause}${rubricClause(rubric)}

Use the anchors as calibration points — place the candidate's response relative to them rather
than scoring in a vacuum. The hardest, most important distinction is in the middle of the range
(e.g. telling a 55 from a 65), not at the extremes. For each criterion, give a short rationale (why
this score) and a specific piece of evidence quoted or closely paraphrased from the candidate's
actual response — never a generic statement that could apply to any answer.

Also write a short "summary": one or two sentences, addressed directly to the candidate ("You..."),
giving a concise, honest, constructive reason for their overall performance on this specific task
— this will be shown/emailed to them directly, so keep it plain, specific, and free of jargon.`;
}
