import { z } from 'zod';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import { INTERACTION, ObjectiveComponentType } from '../roles/role-module.interface';
import { TASK_TEXT_LIMITS, textLimitsForSeniority } from '../task-text-rules';
import { candidateReadingWords, readingWordsCeiling, slotBudgetMinutes, writtenResponseLimit } from './task-budget.util';
import { InterfaceType } from '../roles/interface-type';

/** Same tolerance the scenario ceiling gets: a small overshoot is not worth a regeneration. */
const BUDGET_TOLERANCE = 1.25;

const rankingItems = z.object({ items: z.array(z.object({ label: z.string(), description: z.string() })) });

/** Length feedback for repair; no candidate-facing text is truncated. */
export function taskLengthProblems(
  task: QuestionBankTaskContent,
  objectiveType?: ObjectiveComponentType,
  skillLevel?: string | null,
  budgetMinutes: number = slotBudgetMinutes(),
): string[] {
  const problems: string[] = [];
  const limits = textLimitsForSeniority(skillLevel);
  const readingWords = candidateReadingWords(task);
  const readingCeiling = readingWordsCeiling(budgetMinutes);
  if (readingWords > readingCeiling) {
    problems.push(`The candidate must read ${readingWords} words (scenario, question, reference tabs, tables and options); cut it to at most ${readingCeiling} by removing repeated facts and detail the answer does not need.`);
  }
  const question = task.questionPrompt.trim();
  const words = question ? question.split(/\s+/).length : 0;
  if (words > limits.questionWords) {
    problems.push(`Question has ${words} words; shorten it to at most ${limits.questionWords} words, preserving the essential work and facts.`);
  }
  if (task.expectedDurationMinutes != null && task.expectedDurationMinutes > budgetMinutes) {
    problems.push(`The task is set at ${task.expectedDurationMinutes} minutes but each task has ${budgetMinutes}; shorten the work so it fits and set expectedDurationMinutes to at most ${budgetMinutes}.`);
  }
  // A staged chat keeps its own per-reply limit, so only single written answers are checked here.
  if (task.openEndedComponent && task.interfaceType !== InterfaceType.STAGED_CHAT) {
    const wordLimit = task.interfacePayload.wordLimit as { max: number } | null | undefined;
    const fits = writtenResponseLimit(budgetMinutes, readingWords).max;
    if (!wordLimit) {
      problems.push(`The written answer needs a wordLimit; about ${fits} words fit in ${budgetMinutes} minutes after reading.`);
    } else if (wordLimit.max > fits * BUDGET_TOLERANCE) {
      problems.push(`The word limit of ${wordLimit.max} cannot be written in ${budgetMinutes} minutes after reading ${readingWords} words; set the maximum to about ${fits} (or shorten the reading material).`);
    }
  }
  if (objectiveType === INTERACTION.PRIORITY_RANKING) {
    const ranking = rankingItems.safeParse(task.objectiveComponent);
    if (ranking.success) {
      ranking.data.items.forEach((item, index) => {
        if (item.label.length > TASK_TEXT_LIMITS.rankingLabelCharacters || item.description.length > limits.rankingDescriptionCharacters) {
          problems.push(`Ranking item ${index + 1}: shorten the label to ${TASK_TEXT_LIMITS.rankingLabelCharacters} characters and description to ${limits.rankingDescriptionCharacters} characters; retain comparison facts elsewhere in the candidate-visible task.`);
        }
      });
    }
  }
  return problems;
}
