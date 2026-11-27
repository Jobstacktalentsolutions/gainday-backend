import { z } from 'zod';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import {
  INTERACTION,
  ObjectiveComponentType,
} from '../roles/role-module.interface';
import { InterfaceType } from '../roles/interface-type';
import { TASK_TEXT_LIMITS, textLimitsForSeniority } from '../task-text-rules';
import {
  candidateContextText,
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

const normalise = (text: string) =>
  text
    .replace(/[*_\s]+/g, ' ')
    .trim()
    .toLowerCase();

/** The parts of an item that can name it, such as "Lead A" and "Maya Chen" in "Lead A - Maya Chen". */
const itemNames = (item: { label: string; description: string }) =>
  `${item.label}.${item.description}`
    .split(/[—–\-:(.,;]/)
    .map(normalise)
    .filter((part) => part.length >= 3);

/** A label that states a position ("2nd to call", "Rank 1", "3") gives the answer away and names nothing. */
const POSITION_LABEL =
  /\b\d+(?:st|nd|rd|th)\b|\brank\s*\d|^\s*\d+\s*$|\b(?:call|do|handle|take)\s+(?:first|second|third|fourth|fifth|last)\b|\b(?:first|second|third|fourth|fifth|last)\s+(?:to\s+\w+|call(?:\s*back)?|lead|priority)\b|^\s*(?:first|second|third|fourth|fifth|last)\s*$/i;

/**
 * Ranking items must be the things the scenario asks the candidate to rank. A draft, or a revision that only
 * had to meet a length limit, can turn them into position slots ("Rank 1: lead to call back"), which pass
 * every other check. So a label may not state a position, and at least half of the items must be named in the
 * text the candidate reads.
 */
function rankingItemProblems(
  task: QuestionBankTaskContent,
  items: { label: string; description: string }[],
  limits: { rankingDescriptionCharacters: number },
): string[] {
  const problems: string[] = [];
  items.forEach((item, index) => {
    const over: string[] = [];
    if (item.label.length > TASK_TEXT_LIMITS.rankingLabelCharacters) {
      over.push(
        `the label is ${item.label.length} characters (limit ${TASK_TEXT_LIMITS.rankingLabelCharacters})`,
      );
    }
    if (item.description.length > limits.rankingDescriptionCharacters) {
      over.push(
        `the description is ${item.description.length} characters (limit ${limits.rankingDescriptionCharacters})`,
      );
    }
    if (over.length > 0) {
      problems.push(
        `Ranking item ${index + 1} ("${item.label}"): ${over.join(' and ')}. Shorten only that, keep the item's real name, and keep the facts used to compare items in the scenario.`,
      );
    }
  });
  const positional = items.filter((item) => POSITION_LABEL.test(item.label));
  if (positional.length > 0) {
    problems.push(
      `Ranking labels must name the items, not their position: ${positional.map((item) => `"${item.label}"`).join(', ')}. Use the real name the scenario gives each item; the order is the candidate's answer.`,
    );
  }
  const context = normalise(candidateContextText(task));
  const missing = items.filter(
    (item) => !itemNames(item).some((name) => context.includes(name)),
  );
  if (items.length > 0 && missing.length * 2 >= items.length) {
    problems.push(
      `Ranking items must be the items the scenario names, but ${missing.map((item) => `"${item.label}"`).join(', ')} ${missing.length === 1 ? 'does' : 'do'} not appear in the scenario or reference material. Use the real names the scenario gives.`,
    );
  }
  return problems;
}

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
      problems.push(...rankingItemProblems(task, ranking.data.items, limits));
    }
  }
  return problems;
}
