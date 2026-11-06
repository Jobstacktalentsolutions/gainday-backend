import { Logger } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { TaskCandidateRecord } from '../../../db/schema/job-extractions.schema';
import { generateTaskContent } from '../task-content-generator';
import { TaskSpecError } from '../roles/role-module.interface';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import { taskCandidateSchema } from '../schemas/task-candidate.schema';
import { withGeminiSafeStructuredOutput } from '../../ai/gemini-structured-output.util';
import { z } from 'zod';

const logger = new Logger('GenerationPipeline:taskGeneration');

async function generateReplacementCandidate(
  ctx: GenerationContext,
  state: GenerationState,
): Promise<TaskCandidateRecord> {
  const otherSlotTypes = new Set(
    state.selectedCandidates
      .filter((_, idx) => idx !== state.currentSlotIndex)
      .map((c) => c.taskType),
  );
  for (const id of state.triedCandidateIds) {
    const tried = state.candidatePool.find((c) => c.candidateId === id);
    if (tried) otherSlotTypes.add(tried.taskType);
  }

  let eligibleTypes = state.roleModule.allowedTaskPatternTypes.filter(
    (t) => !otherSlotTypes.has(t.key),
  );
  if (eligibleTypes.length === 0) {
    eligibleTypes = state.roleModule.allowedTaskPatternTypes;
  }

  const eligibleTypeKeys = eligibleTypes.map((t) => t.key) as [
    string,
    ...string[],
  ];
  const schema = z.object({
    candidate: taskCandidateSchema(eligibleTypeKeys),
  });
  const model = withGeminiSafeStructuredOutput(ctx.generationModel, schema);

  const eligibleTypesDescription = eligibleTypes
    .map((t) => `- ${t.key}: ${t.description}`)
    .join('\n');

  const candidateId = `cand-${state.currentSlotIndex + 1}-retry-${state.currentAttempt + 1}`;
  const result = await model.invoke([
    new SystemMessage(
      `Generate a single replacement candidate task for this role to replace a rejected candidate. Favour role-specific expertise.
The task must be highly aligned with the stated Category and Intent, and incorporate the business Problem if provided.
Allowed task types (do not invent new types):
${eligibleTypesDescription}`,
    ),
    new HumanMessage(
      JSON.stringify({
        category: state.category,
        intent: state.intent,
        problem: state.problem,
        candidateId,
      }),
    ),
  ]);

  return {
    candidateId: result.candidate.candidateId || candidateId,
    taskType: result.candidate.taskType,
    briefDescription: result.candidate.briefDescription,
    selected: true,
  };
}

/**
 * Selects the candidate for the current slot: on attempt 0 this is the pre-planned candidate
 * for this slot. On a retry, if an untried candidate exists in the pool it is used; otherwise,
 * a fresh replacement candidate is generated on-demand with an unused taskType.
 */
async function selectCandidateForSlot(
  ctx: GenerationContext,
  state: GenerationState,
): Promise<{
  candidate: TaskCandidateRecord;
  newCandidatePool?: TaskCandidateRecord[];
}> {
  if (state.currentAttempt === 0) {
    const candidate = state.selectedCandidates[state.currentSlotIndex];
    if (!candidate) {
      throw new Error(
        `No selected candidate for slot index ${state.currentSlotIndex}`,
      );
    }
    return { candidate };
  }

  const triedIds = new Set(state.triedCandidateIds);
  const untried = state.candidatePool
    .filter((c) => !triedIds.has(c.candidateId))
    .sort(
      (a, b) =>
        (b.judgeScore?.composite ?? -Infinity) -
        (a.judgeScore?.composite ?? -Infinity),
    );

  if (untried.length > 0) {
    return { candidate: untried[0] };
  }

  logger.log(
    `Slot ${state.currentSlotIndex}: no untried candidates in pool — generating replacement candidate on-demand`,
  );
  const replacement = await generateReplacementCandidate(ctx, state);
  return {
    candidate: replacement,
    newCandidatePool: [...state.candidatePool, replacement],
  };
}

/**
 * On a retry, the critic's reasons for the rejected attempt, so the next attempt corrects them. A fresh
 * slot (attempt 0) has no earlier rejection of its own, so it gets none.
 */
function revisionNotesFor(state: GenerationState): string[] | undefined {
  const previous = state.currentCriticResult;
  if (state.currentAttempt === 0 || !previous || previous.passed)
    return undefined;
  return previous.failureReasons;
}

export function taskGenerationNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const { candidate, newCandidatePool } = await selectCandidateForSlot(
      ctx,
      state,
    );
    logger.log(
      `Slot ${state.currentSlotIndex}, attempt ${state.currentAttempt + 1}: generating task for candidate ${candidate.candidateId} [${candidate.taskType}]`,
    );

    let taskContent: QuestionBankTaskContent;
    try {
      taskContent = await generateTaskContent({
        model: ctx.taskGenerationModel,
        roleModule: state.roleModule,
        category: state.category,
        intent: state.intent,
        problem: state.problem,
        taskType: candidate.taskType,
        briefDescription: candidate.briefDescription,
        revisionNotes: revisionNotesFor(state),
      });
    } catch (err) {
      if (!(err instanceof TaskSpecError)) throw err;
      logger.warn(
        `Slot ${state.currentSlotIndex}: model inputs could not form a valid task — ${err.message}`,
      );
      return {
        currentTaskDraft: {
          candidateId: candidate.candidateId,
          taskType: candidate.taskType,
          taskContent: null,
        },
        draftProblems: [
          `The figures do not form a valid task: ${err.message}.`,
        ],
        ...(newCandidatePool ? { candidatePool: newCandidatePool } : {}),
      };
    }

    logger.log(
      `Slot ${state.currentSlotIndex}: generated "${taskContent.title}" (interfaceType=${taskContent.interfaceType})`,
    );

    return {
      currentTaskDraft: {
        candidateId: candidate.candidateId,
        taskType: taskContent.taskType,
        taskContent,
      },
      draftProblems: [],
      ...(newCandidatePool ? { candidatePool: newCandidatePool } : {}),
    };
  };
}
