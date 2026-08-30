import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { questionBank } from '../../../db/schema/question-bank.schema';

const logger = new Logger('GenerationPipeline:persist');

/**
 * On critic success (doc Section 7.3): persists the task to the question bank (pgvector-indexed,
 * for future novelty checks) and appends it to the in-progress simulation. Reuses the embedding
 * critic.node.ts already computed for this exact taskContent — never recomputed here.
 */
export function persistNode(ctx: GenerationContext) {
  return async (state: GenerationState): Promise<GenerationStateUpdate> => {
    const draft = state.currentTaskDraft;
    if (!draft) {
      throw new Error('persist node invoked with no currentTaskDraft in state');
    }
    if (!state.currentCriticResult) {
      throw new Error(
        'persist node invoked with no currentCriticResult in state',
      );
    }

    const { embedding } = state.currentCriticResult;

    try {
      await ctx.db.insert(questionBank).values({
        category: state.category,
        intent: state.intent,
        taskType: draft.taskType,
        taskContent: draft.taskContent,
        sourceJobId: state.jobId,
        embedding,
      });
    } catch (err) {
      // Drizzle's query-error message embeds the full failed insert params, including the
      // raw 3072-float embedding vector — strip that before it hits the logs/error response.
      if (err instanceof Error) {
        err.message = err.message.replace(
          /\[-?\d+\.\d+(?:,-?\d+\.\d+){10,}\]/g,
          '[embedding omitted]',
        );
      }
      throw err;
    }

    logger.log(
      `Slot ${state.currentSlotIndex}: persisted "${draft.taskContent.title}" to question_bank`,
    );

    return {
      finalizedTasks: [
        {
          candidateId: draft.candidateId,
          taskType: draft.taskType,
          taskContent: draft.taskContent,
        },
      ],
    };
  };
}
