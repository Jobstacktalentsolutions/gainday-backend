import { GenerationContext } from '../graph/generation-context';
import { GenerationState } from '../state/generation-state';
import { regenerationRouter, REGEN_ROUTE } from './regeneration-router';

const ctx = { config: { maxCriticAttempts: 3 } } as unknown as GenerationContext;

function state(attempt: number, critic: Partial<GenerationState['currentCriticResult']>): GenerationState {
  return {
    currentSlotIndex: 0,
    currentAttempt: attempt,
    currentCriticResult: {
      passed: false,
      failureReasons: ['The text states figures the table does not show (13).'],
      noveltyDistance: null,
      isDuplicate: false,
      relevant: true,
      repairable: true,
      embedding: [],
      ...critic,
    },
  } as unknown as GenerationState;
}

describe('regenerationRouter', () => {
  it('persists a passing draft', () => {
    expect(regenerationRouter(ctx)(state(0, { passed: true, failureReasons: [] }))).toBe(REGEN_ROUTE.PERSIST);
  });

  it('repairs a rejected draft whose failures are about wording or figures', () => {
    expect(regenerationRouter(ctx)(state(0, {}))).toBe(REGEN_ROUTE.REPAIR);
  });

  it('starts over with a new candidate when the idea itself was rejected', () => {
    expect(regenerationRouter(ctx)(state(0, { repairable: false, relevant: false }))).toBe(REGEN_ROUTE.RETRY);
    expect(regenerationRouter(ctx)(state(0, { repairable: false, isDuplicate: true }))).toBe(REGEN_ROUTE.RETRY);
  });

  it('sends the slot to admin review once the attempts are used up', () => {
    expect(regenerationRouter(ctx)(state(2, {}))).toBe(REGEN_ROUTE.ADMIN_REVIEW);
  });
});
