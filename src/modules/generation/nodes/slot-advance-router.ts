import { Logger } from '@nestjs/common';
import { GenerationContext } from '../graph/generation-context';
import {
  GenerationState,
  GenerationStateUpdate,
} from '../state/generation-state';

const logger = new Logger('GenerationPipeline:slotAdvanceRouter');

export const SLOT_ADVANCE_ROUTE = {
  NEXT_SLOT: 'next_slot',
  DONE: 'done',
} as const;
export type SlotAdvanceRoute =
  (typeof SLOT_ADVANCE_ROUTE)[keyof typeof SLOT_ADVANCE_ROUTE];

export function slotAdvanceRouter(ctx: GenerationContext) {
  return (state: GenerationState): SlotAdvanceRoute => {
    const hasMoreSlots =
      state.currentSlotIndex < ctx.config.selectedTaskCount - 1;
    if (hasMoreSlots) {
      logger.log(
        `Advancing from slot ${state.currentSlotIndex} to slot ${state.currentSlotIndex + 1} of ${ctx.config.selectedTaskCount}`,
      );
      return SLOT_ADVANCE_ROUTE.NEXT_SLOT;
    }
    logger.log(
      `All ${ctx.config.selectedTaskCount} slots processed — generation graph complete`,
    );
    return SLOT_ADVANCE_ROUTE.DONE;
  };
}

/** State update applied when advancing to the next slot: resets per-slot working state. */
export function slotAdvanceStateUpdate(
  state: GenerationState,
): GenerationStateUpdate {
  return {
    currentSlotIndex: state.currentSlotIndex + 1,
    currentAttempt: 0,
    triedCandidateIds: [],
    currentTaskDraft: null,
    currentCriticResult: null,
  };
}
