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
import { candidateObjectiveView } from '../../simulations/candidate-task.util';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import { candidateReadingText } from '../utils/task-budget.util';
import { answerControls } from '../roles/presentation-capabilities';
import type { ObjectiveComponentType } from '../roles/role-module.interface';

export function buildCritiqueCheckPrompt(skillLevel?: string | null): string {
  return [
    'You are checking a generated job-simulation task.',
    '1. Relevance: the task fits the Category, Intent and seniority. Flag only clear mismatches.',
    'In presentationProblems: the platform shows each answer control with its own items, so the candidate works on them through that control. Report every place the question, scenario or reference material lists, letters or numbers those items, or asks the candidate to type or enter them. Also report clearly repeated evidence and actions the controls cannot do.',
    'Candidate-visible material is scenarioDescription, questionPrompt, interfacePayload and objective item labels and options; answer keys, serverOnly, rubric, openEndedComponent and wordLimit are not.',
    `2. Candidate guidance: ${REQUIREMENT_VS_TIP_RULE}`,
    'Treat instructions to produce, explain, format, scope, or support a deliverable as requirements, not tips.',
  ].join('\n');
}

/**
 * What the critic reads: only what the candidate sees. The grading guidance (openEndedComponent), the
 * platform's word limit and the answer key are not candidate text, so a critic that sees them flags them
 * as tips or leaks; code removes them instead of the prompt asking the model to ignore them.
 */
function candidateVisibleContent(
  task: QuestionBankTaskContent,
  objectiveType?: ObjectiveComponentType,
) {
  const { wordLimit: _wordLimit, ...interfacePayload } = task.interfacePayload;
  return {
    title: task.title,
    scenarioDescription: task.scenarioDescription,
    questionPrompt: task.questionPrompt,
    interfaceType: task.interfaceType,
    interfacePayload,
    objectiveComponent:
      objectiveType && task.objectiveComponent
        ? candidateObjectiveView(objectiveType, task.objectiveComponent)
        : null,
  };
}

/** A tip is a sentence the candidate reads; the model's commentary about the task is not one. */
function quotedTips(
  sentences: string[],
  task: QuestionBankTaskContent,
): string[] {
  const normalise = (text: string) => text.replace(/s+/g, ' ').trim();
  const visible = normalise(
    `${candidateReadingText(task)} ${String(task.interfacePayload.placeholder ?? '')}`,
  );
  return sentences.filter((sentence) => visible.includes(normalise(sentence)));
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
  const result = await structuredModel.invoke([
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
        taskContent: candidateVisibleContent(task.taskContent, objectiveType),
      }),
    ),
  ]);
  return {
    ...result,
    tipSentences: quotedTips(result.tipSentences, task.taskContent),
  };
}
