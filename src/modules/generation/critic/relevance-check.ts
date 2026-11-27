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
    'You are validating a generated job-simulation task. Perform the following checks:',
    '',
    // Section 1: Alignment & Seniority Relevance
    // Confirms the task is on-target for the employer's intended domain and appropriately calibrated to the candidate's expected experience level.
    '1. Relevance: confirm the task aligns with the given Category, Intent, and target Seniority / Skill Level.',
    '',
    getSeniorityCriticGuidance(skillLevel),
    'Reject tasks whose question or scenario conflicts with the supplied evidence, policy, or answer key. Do not assume facts not supplied. A gap the task asks the candidate to handle by stating an assumption is intended, not a conflict. Explain conflicts in reasons.',
    'In presentationProblems, identify substantial repeated evidence across the scenario, reference material and answer controls, or required actions unavailable in availableControls. Short labels referring to evidence are fine. Name the affected fields and preserve facts needed to answer.',
    'Candidate-visible material includes scenarioDescription, questionPrompt, interfacePayload and objective item labels and options. Answer keys, serverOnly, rubric and openEndedComponent are not visible. wordLimit is interface metadata, not an instruction in the question.',
    '',
    `2. Candidate guidance: ${REQUIREMENT_VS_TIP_RULE}`,
    'Treat instructions to produce, explain, format, scope, or support a deliverable with evidence as requirements, not tips. Return only clear advice that gives away the answer or tells the candidate which conclusion or tactic to choose.',
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
