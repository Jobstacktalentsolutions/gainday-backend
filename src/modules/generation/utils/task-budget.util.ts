import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import { DEFAULT_SIMULATION_TIME_LIMIT_MINUTES } from '../../../db/schema/simulations.schema';
import { generationConfig } from '../../../config/ai.config';

/**
 * A task's time is a budget. The model chooses the duration and the word limit, and the critic
 * checks them against what this file derives from the slot budget and what the candidate reads.
 */
export const TASK_BUDGET = {
  readingWordsPerMinute: 200,
  /** Sustained composing speed for a considered answer, not typing speed. */
  writingWordsPerMinute: 30,
  /** Minutes to understand the task and plan the answer. */
  thinkingMinutes: 1,
  /** Candidate-facing words a slot may hold per minute, so reading leaves time to answer. */
  readingWordsPerBudgetMinute: 60,
  minWordsRatio: 0.4,
  minMaxWords: 40,
  minMinWords: 20,
  roundingStep: 10,
} as const;

/** Keys of an interface payload that are not material the candidate reads. */
const NON_READING_PAYLOAD_KEYS = new Set([
  'interfaceType',
  'wordLimit',
  'placeholder',
  // The chart is drawn from the table's figures, so reading both would count them twice.
  'chart',
]);

export function slotBudgetMinutes(
  selectedTaskCount: number = generationConfig.selectedTaskCount,
): number {
  return Math.floor(DEFAULT_SIMULATION_TIME_LIMIT_MINUTES / selectedTaskCount);
}

export function readingWordsCeiling(budgetMinutes: number): number {
  return budgetMinutes * TASK_BUDGET.readingWordsPerBudgetMinute;
}

function countWords(text: string): number {
  return text.split(/[\s,]+/).filter(Boolean).length;
}

function wordsIn(value: unknown, skipKeys?: ReadonlySet<string>): number {
  if (typeof value === 'string') return countWords(value);
  if (Array.isArray(value))
    return value.reduce<number>((sum, item) => sum + wordsIn(item, skipKeys), 0);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce(
      (sum, [key, item]) =>
        skipKeys?.has(key) ? sum : sum + wordsIn(item, skipKeys),
      0,
    );
  }
  return 0;
}

/** Words the candidate must read: scenario, question, reference tabs and tables, and answer options. */
export function candidateReadingWords(task: QuestionBankTaskContent): number {
  return (
    countWords(task.scenarioDescription) +
    countWords(task.questionPrompt) +
    wordsIn(task.interfacePayload, NON_READING_PAYLOAD_KEYS) +
    wordsIn(task.objectiveComponent)
  );
}

function roundToStep(value: number): number {
  return Math.round(value / TASK_BUDGET.roundingStep) * TASK_BUDGET.roundingStep;
}

/** Written-answer limit that fits what is left of the budget after reading and planning. */
export function writtenResponseLimit(
  budgetMinutes: number,
  readingWords: number,
): { min: number; max: number } {
  const writingMinutes =
    budgetMinutes -
    readingWords / TASK_BUDGET.readingWordsPerMinute -
    TASK_BUDGET.thinkingMinutes;
  const max = Math.max(
    TASK_BUDGET.minMaxWords,
    roundToStep(writingMinutes * TASK_BUDGET.writingWordsPerMinute),
  );
  const min = Math.max(
    TASK_BUDGET.minMinWords,
    roundToStep(max * TASK_BUDGET.minWordsRatio),
  );
  return { min, max };
}
