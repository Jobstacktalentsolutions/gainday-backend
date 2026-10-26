import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { taskCriticSchema } from '../schemas/critic-result.schema';
import {
  ExtractionResult,
  GeneratedTaskCandidate,
} from '../roles/role-module.interface';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';

const RELEVANCE_CHECK_PROMPT = `You are validating a generated job-simulation task. Do two checks.
1. Relevance: confirm the task aligns with the given Category and Intent, not just that it is novel
   but that it is on-target for what the employer is trying to assess.
2. Tips: return each sentence in scenarioDescription or questionPrompt that advises the candidate on
   how to do well: approach or steps, example tactics, or what a strong answer does or is judged on.
   Requirements are not tips: the deliverable, recipient, format, length, a word limit, a deadline, and
   content the work must include ("the plan must include a stakeholder map"). Return each sentence
   verbatim, or an empty list.`;

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
