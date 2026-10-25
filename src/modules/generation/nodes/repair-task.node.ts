import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import { GenerationState, GenerationStateUpdate } from '../state/generation-state';
import { reviseTaskContent } from '../task-content-generator';
import { TaskSpecError } from '../roles/role-module.interface';

const logger = new Logger('GenerationPipeline:repairTask');

/**
 * Repairs the rejected draft of the current slot instead of starting over (the router only sends a
 * draft here when the critic marked it repairable). The same candidate stays, and the attempt counts.
 * The critic then checks the repaired draft, so a bad repair is rejected like any other.
 */
export function repairTaskNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const draft = state.currentTaskDraft;
    const critic = state.currentCriticResult;
    if (!draft || !draft.taskContent || !critic) {
      throw new Error('repair node invoked without a repairable draft in state');
    }

    logger.log(
      `Slot ${state.currentSlotIndex}, attempt ${state.currentAttempt + 2}: repairing the rejected draft — ${critic.failureReasons.join(' ')}`,
    );

    try {
      const repaired = await reviseTaskContent({
        model: ctx.taskGenerationModel,
        roleModule: state.roleModule,
        category: state.category,
        intent: state.intent,
        problem: state.problem,
        existingTask: draft.taskContent,
        revisionNotes: critic.failureReasons,
      });
      return {
        currentAttempt: state.currentAttempt + 1,
        currentTaskDraft: { candidateId: draft.candidateId, taskType: repaired.taskType, taskContent: repaired },
        draftProblems: [],
      };
    } catch (err) {
      if (!(err instanceof TaskSpecError)) throw err;
      logger.warn(`Slot ${state.currentSlotIndex}: the repair did not form a valid task — ${err.message}`);
      return {
        currentAttempt: state.currentAttempt + 1,
        currentTaskDraft: { candidateId: draft.candidateId, taskType: draft.taskType, taskContent: null },
        draftProblems: [`The repaired figures do not form a valid task: ${err.message}.`],
      };
    }
  };
}
