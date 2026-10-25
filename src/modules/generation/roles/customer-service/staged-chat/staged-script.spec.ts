import { TaskSpecError } from '../../role-module.interface';
import { validateStagedScript, type StagedChatServerData } from './staged-script';

function script(overrides: Partial<StagedChatServerData> = {}): StagedChatServerData {
  return {
    turns: [
      { message: 'My parcel is late.', typingDelayMs: 1000, checkpoints: ['Apologises'], criticalErrors: [] },
      { message: 'Still nothing.', typingDelayMs: 1500, checkpoints: ['Gives a next step'], criticalErrors: [] },
      { message: 'Okay, what happens now?', typingDelayMs: 900, checkpoints: ['Sets expectations'], criticalErrors: [] },
    ],
    branches: [],
    ...overrides,
  };
}

describe('validateStagedScript', () => {
  it('accepts a well-formed 3-turn script', () => {
    expect(() => validateStagedScript(script(), 3)).not.toThrow();
  });

  it('accepts a 4-turn script when the message count matches', () => {
    const four = script({
      turns: [...script().turns, { message: 'Thanks.', typingDelayMs: 800, checkpoints: ['Closes'], criticalErrors: [] }],
    });
    expect(() => validateStagedScript(four, 4)).not.toThrow();
  });

  it('rejects any turn count other than 3 or 4', () => {
    expect(() => validateStagedScript(script(), 5)).toThrow(TaskSpecError);
  });

  it('rejects a script whose message count differs from the declared turn count', () => {
    expect(() => validateStagedScript(script(), 4)).toThrow('3 customer messages for 4 turns');
  });

  it('rejects a typing delay outside 800–4000 ms', () => {
    const fast = script();
    fast.turns[0].typingDelayMs = 799;
    expect(() => validateStagedScript(fast, 3)).toThrow('typing delay outside');
    const slow = script();
    slow.turns[1].typingDelayMs = 4001;
    expect(() => validateStagedScript(slow, 3)).toThrow('typing delay outside');
  });

  it('rejects duplicate branch ids and branches outside turns 2 to the turn count', () => {
    const branch = { id: 'x', turn: 2, condition: 'c', replacementMessage: 'Fine.' };
    expect(() =>
      validateStagedScript(script({ branches: [branch, { ...branch, turn: 3 }] }), 3),
    ).toThrow('branch ids must be unique');
    expect(() =>
      validateStagedScript(script({ branches: [{ ...branch, turn: 1 }] }), 3),
    ).toThrow('from 2 to 3');
  });

  it('rejects an empty branch replacement message', () => {
    const branch = { id: 'x', turn: 2, condition: 'c', replacementMessage: '  ' };
    expect(() => validateStagedScript(script({ branches: [branch] }), 3)).toThrow('branch "x" replacement is empty');
  });
});
