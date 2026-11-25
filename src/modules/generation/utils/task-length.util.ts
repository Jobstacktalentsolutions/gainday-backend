import { z } from 'zod';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import { INTERACTION, ObjectiveComponentType } from '../roles/role-module.interface';
import { TASK_TEXT_LIMITS, textLimitsForSeniority } from '../task-text-rules';

const rankingItems = z.object({ items: z.array(z.object({ label: z.string(), description: z.string() })) });

/** Length feedback for repair; no candidate-facing text is truncated. */
export function taskLengthProblems(task: QuestionBankTaskContent, objectiveType?: ObjectiveComponentType, skillLevel?: string | null): string[] {
  const problems: string[] = [];
  const limits = textLimitsForSeniority(skillLevel);
  const question = task.questionPrompt.trim();
  const words = question ? question.split(/\s+/).length : 0;
  if (words > limits.questionWords) {
    problems.push(`Question has ${words} words; shorten it to at most ${limits.questionWords} words, preserving the essential work and facts.`);
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
