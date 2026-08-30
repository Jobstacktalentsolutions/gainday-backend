import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { FailedGenerationAttempt } from '../../../db/schema/generation-review.schema';

const logger = new Logger('GenerationPipeline:adminReviewFlag');

/**
 * Cap-exhaustion fallback (doc Section 7.2/7.3): records the failed slot for admin review
 * rather than dropping it silently or force-passing an unvalidated task. Does not persist
 * anything itself — GenerationService writes generation_review_items rows from
 * state.adminReviewItems after the graph completes.
 */
export function adminReviewFlagNode(ctx: GenerationContext) {
  // ctx is unused here (no LLM/DB calls in this node) but kept for signature
  // consistency with every other node factory in the graph.
  void ctx;
  return (state: GenerationState): GenerationStateUpdate => {
    const draft = state.currentTaskDraft;
    const critic = state.currentCriticResult;
    if (!draft || !critic) {
      throw new Error(
        'admin-review-flag node invoked with missing currentTaskDraft/currentCriticResult',
      );
    }

    const attempt: FailedGenerationAttempt = {
      attemptNumber: state.currentAttempt + 1,
      candidateId: draft.candidateId,
      taskDraft: draft.taskContent,
      // Anchors are a grading-time concern, not generated here — see src/modules/grading/.
      anchors: null,
      criticFailureReasons: critic.failureReasons,
    };

    logger.warn(
      `Slot ${state.currentSlotIndex}: exhausted retry attempts, flagging for admin review (last failure: ${critic.failureReasons.join('; ')})`,
    );

    return {
      adminReviewItems: [
        {
          slotIndex: state.currentSlotIndex,
          category: state.category,
          attempts: [attempt],
        },
      ],
    };
  };
}
