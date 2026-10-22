import { GenerationProgressTracker } from './generation-progress';
import { GenerationState } from './state/generation-state';

const passed = {
  currentCriticResult: { passed: true },
} as Partial<GenerationState>;
const failed = {
  currentCriticResult: { passed: false },
} as Partial<GenerationState>;

describe('GenerationProgressTracker', () => {
  it('starts at extraction with 0 percent', () => {
    const tracker = new GenerationProgressTracker(4);

    expect(tracker.start()).toEqual({
      stage: 'extraction',
      percent: 0,
      slot: 1,
      totalSlots: 4,
    });
  });

  it('reaches finalising at 95 after the last slot and never goes backwards', () => {
    const tracker = new GenerationProgressTracker(2);
    const percents: number[] = [tracker.start().percent];

    const steps: [string, Partial<GenerationState>][] = [
      ['extraction', {}],
      ['overgenerate', {}],
      ['rankSelect', {}],
      ['taskGeneration', {}],
      ['critic', passed],
      ['persist', {}],
      ['taskGeneration', {}],
      ['critic', passed],
      ['persist', {}],
    ];
    for (const [node, update] of steps) {
      const event = tracker.onNodeCompleted(node, update);
      if (event) percents.push(event.percent);
    }

    expect(percents).toEqual([...percents].sort((a, b) => a - b));
    expect(percents[percents.length - 1]).toBe(95);
    expect(tracker.onNodeCompleted('persist', {})?.stage).toBe('finalising');
  });

  it('keeps percent when a critic failure sends the slot back to taskGeneration', () => {
    const tracker = new GenerationProgressTracker(4);
    tracker.onNodeCompleted('rankSelect', {});
    tracker.onNodeCompleted('taskGeneration', {});
    const beforeRetry = tracker.onNodeCompleted('critic', failed);

    const retry = tracker.onNodeCompleted('critic', failed);

    expect(beforeRetry?.stage).toBe('taskGeneration');
    expect(retry?.stage).toBe('taskGeneration');
    expect(retry?.percent).toBe(beforeRetry?.percent);
  });

  it('advances to the next slot when a slot goes to admin review', () => {
    const tracker = new GenerationProgressTracker(4);
    tracker.onNodeCompleted('rankSelect', {});

    const event = tracker.onNodeCompleted('adminReviewFlag', {});

    expect(event).toMatchObject({
      stage: 'taskGeneration',
      slot: 2,
      totalSlots: 4,
    });
  });

  it('ignores bookkeeping nodes', () => {
    const tracker = new GenerationProgressTracker(4);

    expect(tracker.onNodeCompleted('prepareRetry', {})).toBeNull();
    expect(tracker.onNodeCompleted('prepareNextSlot', {})).toBeNull();
  });
});
