import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { relevanceCheckSchema } from '../schemas/critic-result.schema';
import { ExtractionResult, GeneratedTaskCandidate } from '../roles/role-module.interface';

const RELEVANCE_CHECK_PROMPT = `You are validating a generated job-simulation task for genuine
relevance. Confirm the task actually aligns with the given Category and Intent — not just that
it is novel, but that it is actually on-target for what the employer is trying to assess.`;

export async function checkRelevance(
  criticModel: BaseChatModel,
  task: GeneratedTaskCandidate,
  extraction: ExtractionResult,
): Promise<{ relevant: boolean; reasons: string[] }> {
  const structuredModel = criticModel.withStructuredOutput(relevanceCheckSchema);
  return structuredModel.invoke([
    new SystemMessage(RELEVANCE_CHECK_PROMPT),
    new HumanMessage(
      JSON.stringify({
        category: extraction.category,
        intent: extraction.intent,
        taskContent: task.taskContent,
      }),
    ),
  ]);
}
