import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import {
  FailedGenerationAttempt,
  generationReviewItems,
} from '../../../db/schema/generation-review.schema';

const logger = new Logger('GenerationPipeline:adminReviewFlag');

/**
 * Cap-exhaustion fallback (doc Section 7.2/7.3): records the failed slot for admin review
 * rather than dropping it silently or force-passing an unvalidated task. Persists the
 * generation_review_items row here, not after the graph, so a later failure in the run
 * cannot lose it.
 */
export function adminReviewFlagNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
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

    const item = {
      slotIndex: state.currentSlotIndex,
      category: state.category,
      attempts: [attempt],
    };

    await ctx.db
      .insert(generationReviewItems)
      .values({ jobId: state.jobId, ...item });

    logger.warn(
      `Slot ${state.currentSlotIndex}: exhausted retry attempts, flagging for admin review (last failure: ${critic.failureReasons.join('; ')})`,
    );

    return { adminReviewItems: [item] };
  };
}
