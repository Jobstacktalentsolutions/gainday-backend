import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { taskGenerationSchema } from '../schemas/task-generation.schema';
import { TaskCandidateRecord } from '../../../db/schema/job-extractions.schema';
import {
  BASE_INTERFACE_TYPES,
  BaseInterfaceType,
  INTERFACE_SCHEMAS,
} from '../roles/interface-type';

const fallbackInterfacePayloadSchema = z.record(z.string(), z.unknown());

function resolveInterfacePayloadSchema(interfaceType: string) {
  if ((BASE_INTERFACE_TYPES as readonly string[]).includes(interfaceType)) {
    return INTERFACE_SCHEMAS[interfaceType as BaseInterfaceType];
  }
  // Role-defined interface type with no registered schema yet — accept any object shape
  // rather than failing generation; the role module should register a real schema when its
  // presentation spec is finalized (doc Section 2.5's extensibility note).
  return fallbackInterfacePayloadSchema;
}

const TASK_GENERATION_PROMPT_BASE = `Generate the full content for one job-simulation task,
matching the given candidate's taskType. Produce a scenario, the task components appropriate to
that taskType, and a set of anchor responses.

Anchor responses are reference points for grading — generate one anchor per configured score
point, each scored against the four fixed criteria below (framed for this role):
- Problem-solving: {{problemSolving}}
- Judgment/execution: {{judgmentExecution}}
- Written communication: {{writtenCommunication}}
- Commercial/domain awareness: {{commercialDomainAwareness}}

The top-scoring anchor should be strong but not implausibly perfect on all four criteria at once —
avoid manufacturing an artificial "perfect" answer that no real strong candidate response would
actually resemble; real strong answers often trade off one dimension for another.`;

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
    const interfacePayloadSchema = resolveInterfacePayloadSchema(interfaceType);

    const promptText = TASK_GENERATION_PROMPT_BASE.replace(
      '{{problemSolving}}',
      roleModule.anchorCriteriaFraming.problemSolving,
    )
      .replace(
        '{{judgmentExecution}}',
        roleModule.anchorCriteriaFraming.judgmentExecution,
      )
      .replace(
        '{{writtenCommunication}}',
        roleModule.anchorCriteriaFraming.writtenCommunication,
      )
      .replace(
        '{{commercialDomainAwareness}}',
        roleModule.anchorCriteriaFraming.commercialDomainAwareness,
      );

    const schema = taskGenerationSchema(
      allowedTypeKeys,
      interfacePayloadSchema,
    );
    const model =
      ctx.generationModel.withStructuredOutput<z.infer<typeof schema>>(schema);

    const result = await model.invoke([
      new SystemMessage(
        `${promptText}\n\nThis task's interfaceType is "${interfaceType}" — the interfacePayload ` +
          `you generate must match that render mode.\n\nGenerate anchors at these score points: ${ctx.config.anchorScorePoints.join(', ')}.`,
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

    return {
      currentTaskDraft: {
        candidateId: candidate.candidateId,
        taskType: result.taskType,
        taskContent: {
          taskType: result.taskType,
          title: result.title,
          scenarioDescription: result.scenarioDescription,
          questionPrompt: result.questionPrompt,
          objectiveComponent: result.objectiveComponent,
          openEndedComponent: result.openEndedComponent,
          businessProblemDerived,
          interfaceType,
          interfacePayload: result.interfacePayload as Record<string, unknown>,
        },
        anchors: result.anchors,
      },
    };
  };
}
