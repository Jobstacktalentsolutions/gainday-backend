import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { TaskCandidateRecord } from '../../../db/schema/job-extractions.schema';
import { generateTaskContent } from '../task-content-generator';

const logger = new Logger('GenerationPipeline:taskGeneration');

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

    const taskContent = await generateTaskContent({
      model: ctx.taskGenerationModel,
      roleModule: state.roleModule,
      category: state.category,
      intent: state.intent,
      problem: state.problem,
      taskType: candidate.taskType,
      briefDescription: candidate.briefDescription,
    });

    logger.log(
      `Slot ${state.currentSlotIndex}: generated "${taskContent.title}" (interfaceType=${taskContent.interfaceType})`,
    );

    return {
      currentTaskDraft: {
        candidateId: candidate.candidateId,
        taskType: taskContent.taskType,
        taskContent,
      },
    };
  };
}
