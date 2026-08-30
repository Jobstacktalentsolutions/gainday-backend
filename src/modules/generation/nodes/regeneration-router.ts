import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import { GenerationState } from '../state/generation-state';

const logger = new Logger('GenerationPipeline:regenerationRouter');

export const REGEN_ROUTE = {
  RETRY: 'retry',
  PERSIST: 'persist',
  ADMIN_REVIEW: 'admin_review',
} as const;
export type RegenRoute = (typeof REGEN_ROUTE)[keyof typeof REGEN_ROUTE];

export function regenerationRouter(ctx: GenerationContext) {
  return (state: GenerationState): RegenRoute => {
    const result = state.currentCriticResult;
    if (!result) {
      throw new Error(
        'regeneration router invoked with no currentCriticResult in state',
      );
    }

    if (result.passed) {
      logger.log(`Slot ${state.currentSlotIndex}: routing to persist`);
      return REGEN_ROUTE.PERSIST;
    }

    if (state.currentAttempt < ctx.config.maxCriticAttempts - 1) {
      logger.log(
        `Slot ${state.currentSlotIndex}: routing to retry (attempt ${state.currentAttempt + 1} of ${ctx.config.maxCriticAttempts})`,
      );
      return REGEN_ROUTE.RETRY;
    }

    logger.log(
      `Slot ${state.currentSlotIndex}: routing to admin review (retry cap ${ctx.config.maxCriticAttempts} exhausted)`,
    );
    return REGEN_ROUTE.ADMIN_REVIEW;
  };
}

/**
 * State update applied on the RETRY path before looping back to task-generation: advances
 * the attempt counter and marks the failed candidate as tried, so the next task-generation
 * pass picks a different candidate from the original pool.
 */
export function retryStateUpdate(state: GenerationState) {
  const draft = state.currentTaskDraft;
  return {
    currentAttempt: state.currentAttempt + 1,
    triedCandidateIds: draft
      ? [...state.triedCandidateIds, draft.candidateId]
      : state.triedCandidateIds,
  };
}
