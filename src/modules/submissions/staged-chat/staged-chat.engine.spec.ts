import type { StagedChatServerData } from '../../generation/roles/customer-service/staged-chat/staged-script';
import {
  buildTranscript,
  decideReply,
  releasedMessage,
  replyProblem,
  type StagedReply,
} from './staged-chat.engine';

const script: StagedChatServerData = {
  turns: [
    { message: 'Where is my parcel?', typingDelayMs: 1200, checkpoints: ['Apologises'], criticalErrors: [] },
    { message: 'It still has not come.', typingDelayMs: 2000, checkpoints: ['Gives a next step'], criticalErrors: [] },
    { message: 'Fine. What now?', typingDelayMs: 900, checkpoints: ['Sets an expectation'], criticalErrors: [] },
  ],
  branches: [
    { id: 'angry', turn: 2, condition: 'reply blames the customer', replacementMessage: 'You are not listening.' },
  ],
};

function reply(turnIndex: number, overrides: Partial<StagedReply> = {}): StagedReply {
  return {
    turnIndex,
    customerMessage: `message ${turnIndex}`,
    branchId: null,
    nextBranchId: null,
    candidateText: `reply ${turnIndex}`,
    idempotencyKey: `key-${turnIndex}`,
    ...overrides,
  };
}

describe('releasedMessage', () => {
  it('releases the scripted message and its delay when no branch applies', () => {
    expect(releasedMessage(script, 2, null)).toEqual({ message: 'It still has not come.', typingDelayMs: 2000 });
  });

  it('replaces the message with the branch, keeping the scripted delay', () => {
    expect(releasedMessage(script, 2, 'angry')).toEqual({ message: 'You are not listening.', typingDelayMs: 2000 });
  });

  it('refuses a branch that does not apply to the turn', () => {
    expect(() => releasedMessage(script, 3, 'angry')).toThrow('does not apply to turn 3');
  });
});

describe('replyProblem', () => {
  it('reports an empty reply and an over-limit reply, and accepts one within the limit', () => {
    expect(replyProblem('   ', { max: 10 })).toBe('EMPTY');
    expect(replyProblem('one two three', { max: 2 })).toBe('TOO_LONG');
    expect(replyProblem('one two', { max: 2 })).toBeNull();
  });
});

describe('decideReply', () => {
  const base = { turn: 2, idempotencyKey: 'abc-123', currentTurn: 2, sessionOpen: true, existing: null };

  it('accepts the current turn of an open chat', () => {
    expect(decideReply(base)).toEqual({ kind: 'accept' });
  });

  it('reports a stale turn with the turn that is current', () => {
    expect(decideReply({ ...base, turn: 1 })).toEqual({ kind: 'stale', currentTurn: 2 });
  });

  it('refuses a reply once the chat is closed', () => {
    expect(decideReply({ ...base, sessionOpen: false })).toEqual({ kind: 'closed' });
  });

  it('replays a stored turn when the idempotency key matches, even after the chat moved on', () => {
    const stored = reply(1, { idempotencyKey: 'abc-123' });
    expect(decideReply({ ...base, turn: 1, currentTurn: 3, existing: stored })).toEqual({
      kind: 'replay',
      reply: stored,
    });
  });

  it('reports a conflict when a stored turn gets a different reply', () => {
    expect(decideReply({ ...base, turn: 1, existing: reply(1, { idempotencyKey: 'other' }) })).toEqual({
      kind: 'conflict',
    });
  });
});

describe('buildTranscript', () => {
  it('returns the grader shape in turn order', () => {
    const transcript = buildTranscript([reply(2, { branchId: 'angry' }), reply(1)]);
    expect(transcript).toEqual([
      { turn: 1, customer_message: 'message 1', candidate_reply: 'reply 1', branch_id: null },
      { turn: 2, customer_message: 'message 2', candidate_reply: 'reply 2', branch_id: 'angry' },
    ]);
  });
});
