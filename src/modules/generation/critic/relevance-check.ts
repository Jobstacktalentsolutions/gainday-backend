import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { taskCriticSchema } from '../schemas/critic-result.schema';
import {
  ExtractionResult,
  GeneratedTaskCandidate,
} from '../roles/role-module.interface';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';
import { REQUIREMENT_VS_TIP_RULE, getSeniorityCriticGuidance } from '../task-text-rules';

export function buildRelevanceCheckPrompt(skillLevel?: string | null): string {
  return [
    'You are validating a generated job-simulation task. Do two checks.',
    '1. Relevance: confirm the task aligns with the given Category, Intent, and target Seniority / Skill Level. Not just that it is novel, but that it is on-target for what the employer is trying to assess.',
    '',
    getSeniorityCriticGuidance(skillLevel),
    '',
    `2. Tips: return each sentence in scenarioDescription or questionPrompt that is a tip. ${REQUIREMENT_VS_TIP_RULE}`,
    '   Requirement: "Reply in no more than 150 words." Requirement: "Calculate the total cost per site."',
    '   Tip: "Keep the tone calm and avoid technical terms." Tip: "Start by acknowledging the delay."',
    '   Return each sentence verbatim, or an empty list.',
  ].join('\n');
}

/** One call for both checks: relevance against the extraction, and tips in the candidate text. */
export async function checkRelevance(
  criticModel: BaseChatModel,
  task: GeneratedTaskCandidate,
  extraction: ExtractionResult,
): Promise<{
  relevant: boolean;
  reasons: string[];
  tipSentences: string[];
}> {
  const structuredModel = withGeminiSafeStructuredOutput(
    criticModel,
    taskCriticSchema,
  );
  return structuredModel.invoke([
    new SystemMessage(buildRelevanceCheckPrompt(extraction.skillLevel)),
    new HumanMessage(
      JSON.stringify({
        category: extraction.category,
        intent: extraction.intent,
        skillLevel: extraction.skillLevel ?? null,
        taskContent: task.taskContent,
      }),
    ),
  ]);
}
