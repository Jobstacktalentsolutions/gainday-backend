import { z } from 'zod';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import {
  INTERACTION,
  ObjectiveComponentType,
} from '../roles/role-module.interface';
import { InterfaceType } from '../roles/interface-type';
import { TASK_TEXT_LIMITS, textLimitsForSeniority } from '../task-text-rules';
import {
  candidateReadingWords,
  hasReferenceMaterial,
  readingBreakdown,
  readingBudget,
  slotBudgetMinutes,
  writtenResponseLimit,
} from './task-budget.util';
import { countWords } from '../../../utils/word-count.util';

/** A small overshoot is not worth a regeneration. Applies to every section and to the total. */
const BUDGET_TOLERANCE = 1.25;

const rankingItems = z.object({
  items: z.array(z.object({ label: z.string(), description: z.string() })),
});

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
  const budget = readingBudget(
    budgetMinutes,
    limits.questionWords,
    hasReferenceMaterial([task.interfaceType]),
  );
  const read = readingBreakdown(task);

  if (readingWords > budget.total * BUDGET_TOLERANCE) {
    problems.push(
      `The candidate must read ${readingWords} words against a limit of ${budget.total}: scenario ${read.scenario} (limit ${budget.scenario}), question ${read.question} (limit ${budget.question}), reference tabs, tables and options ${read.reference} (limit ${budget.reference}). Shorten each section over its limit to that limit by removing repeated or unnecessary wording first.`,
    );
  } else if (read.scenario > budget.scenario * BUDGET_TOLERANCE) {
    problems.push(
      `The scenario is ${read.scenario} words; shorten it to about ${budget.scenario} by removing repeated or unnecessary wording. Keep every fact the answer needs.`,
    );
  }

  const question = countWords(task.questionPrompt);
  if (question > limits.questionWords) {
    problems.push(
      `Question has ${question} words; shorten it to at most ${limits.questionWords} words, preserving the essential work and facts.`,
    );
  }
  if (
    task.expectedDurationMinutes != null &&
    task.expectedDurationMinutes > budgetMinutes
  ) {
    problems.push(
      `The task is set at ${task.expectedDurationMinutes} minutes but each task has ${budgetMinutes}; shorten the work so it fits and set expectedDurationMinutes to at most ${budgetMinutes}.`,
    );
  }
  // A staged chat keeps its own per-reply limit, so only single written answers are checked here.
  if (
    task.openEndedComponent &&
    task.interfaceType !== InterfaceType.STAGED_CHAT
  ) {
    const wordLimit = task.interfacePayload.wordLimit as
      { max: number } | null | undefined;
    const fits = writtenResponseLimit(budgetMinutes, readingWords).max;
    if (!wordLimit) {
      problems.push(
        `The written answer needs a wordLimit; about ${fits} words fit in ${budgetMinutes} minutes after reading.`,
      );
    } else if (wordLimit.max > fits * BUDGET_TOLERANCE) {
      problems.push(
        `The word limit of ${wordLimit.max} cannot be written in ${budgetMinutes} minutes after reading ${readingWords} words; set the maximum to about ${fits} (or shorten the reading material).`,
      );
    }
  }
  if (objectiveType === INTERACTION.PRIORITY_RANKING) {
    const ranking = rankingItems.safeParse(task.objectiveComponent);
    if (ranking.success) {
      ranking.data.items.forEach((item, index) => {
        if (
          item.label.length > TASK_TEXT_LIMITS.rankingLabelCharacters ||
          item.description.length > limits.rankingDescriptionCharacters
        ) {
          problems.push(
            `Ranking item ${index + 1}: shorten the label to ${TASK_TEXT_LIMITS.rankingLabelCharacters} characters and description to ${limits.rankingDescriptionCharacters} characters; retain comparison facts elsewhere in the candidate-visible task.`,
          );
        }
      });
    }
  }
  return problems;
}
