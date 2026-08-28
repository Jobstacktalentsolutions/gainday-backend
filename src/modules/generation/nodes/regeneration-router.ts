import { GenerationContext } from '../graph/generation-context';
import { GenerationState } from '../state/generation-state';

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
      return REGEN_ROUTE.PERSIST;
    }

    if (state.currentAttempt < ctx.config.maxCriticAttempts - 1) {
      return REGEN_ROUTE.RETRY;
    }

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
