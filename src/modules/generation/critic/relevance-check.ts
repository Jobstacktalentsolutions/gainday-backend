import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { taskCriticSchema } from '../schemas/critic-result.schema';
import {
  ExtractionResult,
  GeneratedTaskCandidate,
} from '../roles/role-module.interface';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';
import {
  REQUIREMENT_VS_TIP_RULE,
  getSeniorityCriticGuidance,
} from '../task-text-rules';
import { answerControls } from '../roles/presentation-capabilities';
import type { ObjectiveComponentType } from '../roles/role-module.interface';

export function buildCritiqueCheckPrompt(skillLevel?: string | null): string {
  return [
    'You are checking a generated job-simulation task. Be lenient: flag only clear problems.',
    '1. Relevance: the task fits the Category, Intent and seniority.',
    'In presentationProblems, note clearly repeated evidence across the scenario, reference material and answer controls, or actions the controls cannot do.',
    'Candidate-visible material is scenarioDescription, questionPrompt, interfacePayload and objective item labels and options; answer keys, serverOnly, rubric, openEndedComponent and wordLimit are not.',
    `2. Candidate guidance: ${REQUIREMENT_VS_TIP_RULE}`,
    'Treat instructions to produce, explain, format, scope, or support a deliverable as requirements, not tips.',
  ].join('\n');
}

/** One call for both checks: relevance against the extraction, and tips in the candidate text. */
export async function checkRelevance(
  criticModel: BaseChatModel,
  task: GeneratedTaskCandidate,
  extraction: ExtractionResult,
  objectiveType?: ObjectiveComponentType,
): Promise<{
  relevant: boolean;
  reasons: string[];
  tipSentences: string[];
  presentationProblems: string[];
}> {
  const structuredModel = withGeminiSafeStructuredOutput(
    criticModel,
    taskCriticSchema,
  );
  return structuredModel.invoke([
    new SystemMessage(buildCritiqueCheckPrompt(extraction.skillLevel)),
    new HumanMessage(
      JSON.stringify({
        category: extraction.category,
        intent: extraction.intent,
        skillLevel: extraction.skillLevel ?? null,
        availableControls: answerControls(
          task.taskContent.interfaceType,
          objectiveType,
        ),
        taskContent: task.taskContent,
      }),
    ),
  ]);
}
