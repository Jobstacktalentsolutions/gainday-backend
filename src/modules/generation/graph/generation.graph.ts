import { StateGraph, START, END } from '@langchain/langgraph';
import {
  GenerationState,
  GenerationStateAnnotation,
  GenerationStateUpdate,
} from '../state/generation-state';
import { GenerationConfig, GenerationContext } from './generation-context';
import { extractionNode } from '../nodes/extraction.node';
import { overgenerateNode } from '../nodes/overgenerate.node';
import { rankSelectNode } from '../nodes/rank-select.node';
import { taskGenerationNode } from '../nodes/task-generation.node';
import { criticNode } from '../nodes/critic.node';
import { persistNode } from '../nodes/persist.node';
import { adminReviewFlagNode } from '../nodes/admin-review-flag.node';
import { repairTaskNode } from '../nodes/repair-task.node';
import {
  regenerationRouter,
  retryStateUpdate,
  REGEN_ROUTE,
} from '../nodes/regeneration-router';
import {
  slotAdvanceRouter,
  slotAdvanceStateUpdate,
  SLOT_ADVANCE_ROUTE,
} from '../nodes/slot-advance-router';

/** No-op bookkeeping nodes that apply the retry/slot-advance state updates produced by the
 *  router functions above, since LangGraph conditional edges route but don't themselves
 *  mutate state — the update has to happen in a node. */
function prepareRetryNode() {
  return (state: GenerationState): GenerationStateUpdate =>
    retryStateUpdate(state);
}

function prepareNextSlotNode() {
  return (state: GenerationState): GenerationStateUpdate =>
    slotAdvanceStateUpdate(state);
}

/**
 * Upper bound on LangGraph supersteps for one run (LangGraph's default limit is 25, which a
 * 4-slot run with critic retries exceeds). Preamble is extraction, overgenerate, rankSelect. Each
 * slot runs up to maxCriticAttempts attempts of taskGeneration, critic and one routed node, plus
 * prepareNextSlot.
 */
export function generationRecursionLimit(config: GenerationConfig): number {
  const preambleSteps = 3;
  const stepsPerAttempt = 3;
  const stepsPerSlot = config.maxCriticAttempts * stepsPerAttempt + 1;
  return preambleSteps + config.selectedTaskCount * stepsPerSlot;
}

export function buildGenerationGraph(ctx: GenerationContext) {
  const graph = new StateGraph(GenerationStateAnnotation)
    .addNode('extraction', extractionNode(ctx))
    .addNode('overgenerate', overgenerateNode(ctx))
    .addNode('rankSelect', rankSelectNode(ctx))
    .addNode('taskGeneration', taskGenerationNode(ctx))
    .addNode('critic', criticNode(ctx))
    .addNode('persist', persistNode(ctx))
    .addNode('adminReviewFlag', adminReviewFlagNode(ctx))
    .addNode('prepareRetry', prepareRetryNode())
    .addNode('repairTask', repairTaskNode(ctx))
    .addNode('prepareNextSlot', prepareNextSlotNode())
    .addEdge(START, 'extraction')
    .addEdge('extraction', 'overgenerate')
    .addEdge('overgenerate', 'rankSelect')
    .addEdge('rankSelect', 'taskGeneration')
    .addEdge('taskGeneration', 'critic')
    .addConditionalEdges('critic', regenerationRouter(ctx), {
      [REGEN_ROUTE.REPAIR]: 'repairTask',
      [REGEN_ROUTE.RETRY]: 'prepareRetry',
      [REGEN_ROUTE.PERSIST]: 'persist',
      [REGEN_ROUTE.ADMIN_REVIEW]: 'adminReviewFlag',
    })
    .addEdge('prepareRetry', 'taskGeneration')
    .addEdge('repairTask', 'critic')
    .addConditionalEdges('persist', slotAdvanceRouter(ctx), {
      [SLOT_ADVANCE_ROUTE.NEXT_SLOT]: 'prepareNextSlot',
      [SLOT_ADVANCE_ROUTE.DONE]: END,
    })
    .addConditionalEdges('adminReviewFlag', slotAdvanceRouter(ctx), {
      [SLOT_ADVANCE_ROUTE.NEXT_SLOT]: 'prepareNextSlot',
      [SLOT_ADVANCE_ROUTE.DONE]: END,
    })
    .addEdge('prepareNextSlot', 'taskGeneration');

  return graph.compile();
}
