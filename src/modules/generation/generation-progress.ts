import { GenerationState } from './state/generation-state';

export const GENERATION_STAGES = [
  'extraction',
  'overgenerate',
  'rankSelect',
  'taskGeneration',
  'critic',
  'persist',
  'finalising',
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number];

export interface GenerationProgress {
  stage: GenerationStage;
  percent: number;
  slot: number;
  totalSlots: number;
}

/** Cumulative percent reached once each pre-loop node completes. */
const PREAMBLE_END_PERCENT = {
  extraction: 10,
  overgenerate: 20,
  rankSelect: 30,
};
/** Percent reserved for the per-slot loop, split evenly across slots. */
const SLOT_LOOP_PERCENT = 65;
const FINALISING_PERCENT = 95;

/** Fraction of one slot's share completed when a given node finishes. */
const SLOT_FRACTION = {
  taskGeneration: 0.5,
  critic: 0.8,
  persist: 1,
  adminReviewFlag: 1,
} as const;

type PreambleNode = keyof typeof PREAMBLE_END_PERCENT;
type SlotNode = keyof typeof SLOT_FRACTION;

const isPreambleNode = (node: string): node is PreambleNode =>
  node in PREAMBLE_END_PERCENT;
const isSlotNode = (node: string): node is SlotNode => node in SLOT_FRACTION;

const PREAMBLE_NEXT_STAGE: Record<PreambleNode, GenerationStage> = {
  extraction: 'overgenerate',
  overgenerate: 'rankSelect',
  rankSelect: 'taskGeneration',
};

/**
 * Turns LangGraph node completions into a monotonic progress bar. Each event describes the step
 * now in progress. Critic retries re-enter taskGeneration, so percent is clamped to never go back.
 */
export class GenerationProgressTracker {
  private slotIndex = 0;
  private percent = 0;

  constructor(private readonly totalSlots: number) {}

  start(): GenerationProgress {
    return this.emit('extraction', 0);
  }

  /** Returns the next progress event for a completed node, or null for bookkeeping nodes. */
  onNodeCompleted(
    node: string,
    update: Partial<GenerationState>,
  ): GenerationProgress | null {
    if (isPreambleNode(node)) {
      return this.emit(PREAMBLE_NEXT_STAGE[node], PREAMBLE_END_PERCENT[node]);
    }
    if (isSlotNode(node)) {
      return this.onSlotNodeCompleted(node, update);
    }
    return null;
  }

  private get slotShare(): number {
    return SLOT_LOOP_PERCENT / this.totalSlots;
  }

  private slotBase(): number {
    return PREAMBLE_END_PERCENT.rankSelect + this.slotIndex * this.slotShare;
  }

  private onSlotNodeCompleted(
    node: SlotNode,
    update: Partial<GenerationState>,
  ): GenerationProgress {
    const reached = this.slotBase() + this.slotShare * SLOT_FRACTION[node];

    if (node === 'taskGeneration') {
      return this.emit('critic', reached);
    }
    if (node === 'critic') {
      const passed = update.currentCriticResult?.passed === true;
      return this.emit(passed ? 'persist' : 'taskGeneration', reached);
    }

    // persist or adminReviewFlag: the slot is finished.
    if (this.slotIndex >= this.totalSlots - 1) {
      return this.emit('finalising', FINALISING_PERCENT);
    }
    this.slotIndex++;
    return this.emit('taskGeneration', this.slotBase());
  }

  private emit(stage: GenerationStage, reached: number): GenerationProgress {
    this.percent = Math.max(this.percent, Math.round(reached));
    return {
      stage,
      percent: this.percent,
      slot: this.slotIndex + 1,
      totalSlots: this.totalSlots,
    };
  }
}
