import { Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { taskGenerationSchema } from '../schemas/task-generation.schema';
import { TaskCandidateRecord } from '../../../db/schema/job-extractions.schema';
import { INTERFACE_SCHEMAS } from '../roles/interface-type';
import {
  OBJECTIVE_COMPONENT_SCHEMAS,
  OPEN_ENDED_COMPONENT_SCHEMAS,
} from '../roles/component-schemas';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';

const logger = new Logger('GenerationPipeline:taskGeneration');

const TASK_GENERATION_PROMPT_BASE = `Generate the full content for one job-simulation task,
matching the given candidate's taskType. Produce a scenario and the task components appropriate
to that taskType.

Free-text fields (scenarioDescription, questionPrompt, and any markdown-documented field in
interfacePayload) are GitHub-flavored Markdown. Use markdown syntax (bold, italics,
bullet/numbered lists) only where structure genuinely aids readability — e.g. presenting several
distinct emails, line items, or steps — never HTML, and never as decoration on plain prose that
reads fine without it.`;

/**
 * Selects the next candidate to attempt for the current slot: on a fresh slot this is the
 * pre-ranked selected candidate; on a regeneration retry this is the next-best untried
 * candidate from the ORIGINAL overgenerated pool (never re-running extraction), per doc
 * Section 7.2.
 */
function selectCandidateForSlot(state: GenerationState): TaskCandidateRecord {
  if (state.currentAttempt === 0) {
    const candidate = state.selectedCandidates[state.currentSlotIndex];
    if (!candidate) {
      throw new Error(
        `No selected candidate for slot index ${state.currentSlotIndex}`,
      );
    }
    return candidate;
  }

  const triedIds = new Set(state.triedCandidateIds);
  const untried = state.candidatePool
    .filter((c) => !triedIds.has(c.candidateId))
    .sort(
      (a, b) =>
        (b.judgeScore?.composite ?? -Infinity) -
        (a.judgeScore?.composite ?? -Infinity),
    );

  const next = untried[0];
  if (!next) {
    throw new Error(
      `No untried candidates remain in the pool for slot index ${state.currentSlotIndex}`,
    );
  }
  return next;
}

export function taskGenerationNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const candidate = selectCandidateForSlot(state);
    logger.log(
      `Slot ${state.currentSlotIndex}, attempt ${state.currentAttempt + 1}: generating task for candidate ${candidate.candidateId} [${candidate.taskType}]`,
    );

    const roleModule = state.roleModule;
    const allowedTypeKeys = roleModule.allowedTaskPatternTypes.map(
      (t) => t.key,
    ) as [string, ...string[]];

    const patternTypeDef = roleModule.allowedTaskPatternTypes.find(
      (t) => t.key === candidate.taskType,
    );
    if (!patternTypeDef) {
      throw new Error(
        `No task-pattern-type definition found for candidate taskType "${candidate.taskType}" in role module for category "${state.category}"`,
      );
    }
    const interfaceType = patternTypeDef.interfaceType;
    const interfacePayloadSchema = INTERFACE_SCHEMAS[interfaceType];
    const objectiveComponentSchema = patternTypeDef.objectiveComponentType
      ? OBJECTIVE_COMPONENT_SCHEMAS[patternTypeDef.objectiveComponentType]
      : null;
    const openEndedComponentSchema = patternTypeDef.openEndedComponentType
      ? OPEN_ENDED_COMPONENT_SCHEMAS[patternTypeDef.openEndedComponentType]
      : null;

    const schema = taskGenerationSchema(
      allowedTypeKeys,
      interfacePayloadSchema,
      objectiveComponentSchema,
      openEndedComponentSchema,
    );
    const model = withGeminiSafeStructuredOutput(
      ctx.taskGenerationModel,
      schema,
    );

    const result = await model.invoke([
      new SystemMessage(
        `${TASK_GENERATION_PROMPT_BASE}\n\nThis task's interfaceType is "${interfaceType}" — the ` +
          `interfacePayload you generate must match that render mode.`,
      ),
      new HumanMessage(
        JSON.stringify({
          category: state.category,
          intent: state.intent,
          problem: state.problem,
          candidate: {
            taskType: candidate.taskType,
            briefDescription: candidate.briefDescription,
          },
        }),
      ),
    ]);

    // Hard rule enforcement, not just prompt-trusted: never fabricate a business problem.
    const businessProblemDerived =
      state.problem === null ? false : result.businessProblemDerived;

    logger.log(
      `Slot ${state.currentSlotIndex}: generated "${result.title}" (interfaceType=${interfaceType})`,
    );

    return {
      currentTaskDraft: {
        candidateId: candidate.candidateId,
        taskType: result.taskType,
        taskContent: {
          taskType: result.taskType,
          title: result.title,
          scenarioDescription: result.scenarioDescription,
          questionPrompt: result.questionPrompt,
          objectiveComponent:
            (result.objectiveComponent as Record<string, unknown> | null) ??
            undefined,
          openEndedComponent:
            (result.openEndedComponent as Record<string, unknown> | null) ??
            undefined,
          businessProblemDerived,
          interfaceType,
          interfacePayload: result.interfacePayload as Record<string, unknown>,
        },
      },
    };
  };
}
