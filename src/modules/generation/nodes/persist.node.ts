import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';
import { questionBank } from '../../../db/schema/question-bank.schema';

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
      throw new Error('persist node invoked with no currentCriticResult in state');
    }

    const { embedding } = state.currentCriticResult;

    await ctx.db.insert(questionBank).values({
      category: state.category,
      intent: state.intent,
      taskType: draft.taskType,
      taskContent: draft.taskContent,
      anchors: draft.anchors,
      sourceJobId: state.jobId,
      embedding,
    });

    return {
      finalizedTasks: [
        {
          candidateId: draft.candidateId,
          taskType: draft.taskType,
          taskContent: draft.taskContent,
          anchors: draft.anchors,
        },
      ],
    };
  };
}
