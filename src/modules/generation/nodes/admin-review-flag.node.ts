import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import {
  FinalizedTask,
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import {
  FailedGenerationAttempt,
  generationReviewItems,
} from '../../../db/schema/generation-review.schema';
import { questionBank } from '../../../db/schema/question-bank.schema';
import { embedTaskContent } from '../utils/embedding.util';

const logger = new Logger('GenerationPipeline:adminReviewFlag');

/**
 * Cap-exhaustion fallback (doc Section 7.2/7.3): records the failed slot for admin review
 * while still persisting the generated task draft so the job simulation retains all tasks
 * (avoiding user confusion with missing slots). Persists both the generation_review_items
 * row and question_bank entry here so AI oversight can review/edit while the simulation
 * remains complete.
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
      'Slot ' + state.currentSlotIndex + ': exhausted retry attempts, flagging for admin review (last failure: ' + critic.failureReasons.join('; ') + ')',
    );

    const finalizedTasks: FinalizedTask[] = [];

    if (draft.taskContent) {
      try {
        let embedding = critic.embedding;
        if (!embedding) {
          embedding = await embedTaskContent(ctx.embeddings, draft.taskContent);
        }

        const [inserted] = await ctx.db
          .insert(questionBank)
          .values({
            category: state.category,
            intent: state.intent,
            taskType: draft.taskType,
            taskContent: draft.taskContent,
            sourceJobId: state.jobId,
            embedding,
          })
          .returning({ id: questionBank.id });

        finalizedTasks.push({
          candidateId: draft.candidateId,
          questionBankId: inserted.id,
          taskType: draft.taskType,
          taskContent: draft.taskContent,
          inReview: true,
        });

        logger.log(
          'Slot ' + state.currentSlotIndex + ': retained ' + draft.taskContent.title + ' in simulation with question_bank id ' + inserted.id + ' while flagged for admin review',
        );
      } catch (err) {
        logger.error(
          'Slot ' + state.currentSlotIndex + ': failed to persist task to question_bank during admin review flagging:',
          err,
        );
      }
    }

    return {
      adminReviewItems: [item],
      ...(finalizedTasks.length > 0 ? { finalizedTasks } : {}),
    };
  };
}