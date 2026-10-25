import type { StagedChatServerData } from '../../generation/roles/customer-service/staged-chat/staged-script';

// Pure rules for a staged chat: which turn is next, which customer message is released, whether a
// reply is accepted, and what the transcript looks like for grading. No database access here.

export interface StagedReply {
  turnIndex: number;
  customerMessage: string;
  branchId: string | null;
  nextBranchId: string | null;
  candidateText: string;
  idempotencyKey: string;
}

export interface ReleasedMessage {
  message: string;
  typingDelayMs: number;
}

export interface TranscriptEntry {
  turn: number;
  customer_message: string;
  candidate_reply: string;
  branch_id: string | null;
}

export type ReplyDecision =
  | { kind: 'accept' }
  | { kind: 'replay'; reply: StagedReply }
  | { kind: 'conflict' }
  | { kind: 'stale'; currentTurn: number }
  | { kind: 'closed' };

/** The customer message for `turn`, with the branch replacement applied when `branchId` names a
 *  branch for that turn. The typing delay always comes from the turn's own script entry. */
export function releasedMessage(
  script: StagedChatServerData,
  turn: number,
  branchId: string | null,
): ReleasedMessage {
  const scripted = script.turns[turn - 1];
  if (!scripted) throw new Error(`no scripted customer message for turn ${turn}`);
  if (branchId === null) return { message: scripted.message, typingDelayMs: scripted.typingDelayMs };

  const branch = script.branches.find((candidate) => candidate.id === branchId && candidate.turn === turn);
  if (!branch) throw new Error(`branch "${branchId}" does not apply to turn ${turn}`);
  return { message: branch.replacementMessage, typingDelayMs: scripted.typingDelayMs };
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** Why a reply cannot be stored, or null when it can. */
export function replyProblem(text: string, wordLimit: { max: number }): 'EMPTY' | 'TOO_LONG' | null {
  if (text.trim() === '') return 'EMPTY';
  if (wordCount(text) > wordLimit.max) return 'TOO_LONG';
  return null;
}

/**
 * Decides what a posted reply means. A retry of a stored turn with the same idempotency key replays
 * the stored response; a different key for a stored turn is a conflict; anything else must be the
 * current turn of an open session.
 */
export function decideReply(input: {
  turn: number;
  idempotencyKey: string;
  currentTurn: number;
  sessionOpen: boolean;
  existing: StagedReply | null;
}): ReplyDecision {
  if (input.existing) {
    return input.existing.idempotencyKey === input.idempotencyKey
      ? { kind: 'replay', reply: input.existing }
      : { kind: 'conflict' };
  }
  if (!input.sessionOpen) return { kind: 'closed' };
  if (input.turn !== input.currentTurn) return { kind: 'stale', currentTurn: input.currentTurn };
  return { kind: 'accept' };
}

/** The transcript in the grader's shape: one entry per answered turn, in order. */
export function buildTranscript(replies: StagedReply[]): TranscriptEntry[] {
  return [...replies]
    .sort((a, b) => a.turnIndex - b.turnIndex)
    .map((reply) => ({
      turn: reply.turnIndex,
      customer_message: reply.customerMessage,
      candidate_reply: reply.candidateText,
      branch_id: reply.branchId,
    }));
}
