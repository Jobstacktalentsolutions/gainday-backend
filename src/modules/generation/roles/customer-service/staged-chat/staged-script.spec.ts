import { TaskSpecError } from '../../role-module.interface';
import { validateStagedScript, type StagedChatServerData } from './staged-script';

const caseFile = 'Priya S.\nAccount since 2024\nPolicy: refunds within 30 days';

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
    expect(() => validateStagedScript(script(), 3, caseFile)).not.toThrow();
  });

  it('accepts a 4-turn script when the message count matches', () => {
    const four = script({
      turns: [...script().turns, { message: 'Thanks.', typingDelayMs: 800, checkpoints: ['Closes'], criticalErrors: [] }],
    });
    expect(() => validateStagedScript(four, 4, caseFile)).not.toThrow();
  });

  it('rejects any turn count other than 3 or 4', () => {
    expect(() => validateStagedScript(script(), 5, caseFile)).toThrow(TaskSpecError);
  });

  it('rejects a script whose message count differs from the declared turn count', () => {
    expect(() => validateStagedScript(script(), 4, caseFile)).toThrow('3 customer messages for 4 turns');
  });

  it('rejects a typing delay outside 800–4000 ms', () => {
    const fast = script();
    fast.turns[0].typingDelayMs = 799;
    expect(() => validateStagedScript(fast, 3, caseFile)).toThrow('typing delay outside');
    const slow = script();
    slow.turns[1].typingDelayMs = 4001;
    expect(() => validateStagedScript(slow, 3, caseFile)).toThrow('typing delay outside');
  });

  it.each(['As you said, I will wait.', 'You mentioned a refund earlier.', 'Thanks for your last reply.'])(
    'rejects a message that refers to the reply: "%s"',
    (message) => {
      const bad = script();
      bad.turns[1].message = message;
      expect(() => validateStagedScript(bad, 3, caseFile)).toThrow('refers to what the candidate said');
    },
  );

  it('rejects a figure the case file does not show', () => {
    const bad = script();
    bad.turns[0].message = 'I paid 250 pounds.';
    expect(() => validateStagedScript(bad, 3, caseFile)).toThrow('figures the case file does not show');
  });

  it('accepts a figure the case file shows', () => {
    const good = script();
    good.turns[0].message = 'It has been since 2024.';
    expect(() => validateStagedScript(good, 3, caseFile)).not.toThrow();
  });

  it('rejects duplicate branch ids and branches outside turns 2 to the turn count', () => {
    const branch = { id: 'x', turn: 2, condition: 'c', replacementMessage: 'Fine.' };
    expect(() =>
      validateStagedScript(script({ branches: [branch, { ...branch, turn: 3 }] }), 3, caseFile),
    ).toThrow('branch ids must be unique');
    expect(() =>
      validateStagedScript(script({ branches: [{ ...branch, turn: 1 }] }), 3, caseFile),
    ).toThrow('from 2 to 3');
  });

  it('applies the reply rules to branch replacement messages', () => {
    const branch = { id: 'x', turn: 2, condition: 'c', replacementMessage: 'As you said, fine.' };
    expect(() => validateStagedScript(script({ branches: [branch] }), 3, caseFile)).toThrow('branch "x" replacement');
  });
});
