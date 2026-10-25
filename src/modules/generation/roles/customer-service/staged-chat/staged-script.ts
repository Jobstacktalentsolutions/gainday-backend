import { z } from 'zod';
import { TaskSpecError } from '../../role-module.interface';
import { STAGED_CHAT_TURN_COUNTS } from '../../interface-type';

// Server-only script for a staged chat (customer service doc Section 2.8). It is stored on the
// question-bank row and never copied into the simulation task the candidate reads.

export interface StagedChatTurnScript {
  message: string;
  typingDelayMs: number;
  checkpoints: string[];
  criticalErrors: string[];
}

export interface StagedChatBranch {
  id: string;
  /** The turn (2 to turnCount) whose customer message this branch replaces. */
  turn: number;
  condition: string;
  replacementMessage: string;
}

export interface StagedChatServerData {
  turns: StagedChatTurnScript[];
  branches: StagedChatBranch[];
}

export const TYPING_DELAY_MIN_MS = 800;
export const TYPING_DELAY_MAX_MS = 4000;

/** Checks one customer message is non-empty. Throws a TaskSpecError naming the problem. */
export function validateCustomerMessage(message: string, where: string): void {
  if (message.trim() === '') throw new TaskSpecError(`${where} is empty`);
}

/**
 * Checks the whole script against the rules in the staged chat spec. Throws a TaskSpecError for the
 * first rule broken. Rules the generator must follow but this cannot check (when to use 4 turns)
 * live in the generation prompt.
 */
export function validateStagedScript(script: StagedChatServerData, turnCount: number): void {
  if (!(STAGED_CHAT_TURN_COUNTS as readonly number[]).includes(turnCount)) {
    throw new TaskSpecError(`a staged chat has 3 or 4 turns, not ${turnCount}`);
  }
  if (script.turns.length !== turnCount) {
    throw new TaskSpecError(`the script has ${script.turns.length} customer messages for ${turnCount} turns`);
  }

  script.turns.forEach((turn, index) => {
    const where = `customer message ${index + 1}`;
    validateCustomerMessage(turn.message, where);
    if (
      !Number.isInteger(turn.typingDelayMs) ||
      turn.typingDelayMs < TYPING_DELAY_MIN_MS ||
      turn.typingDelayMs > TYPING_DELAY_MAX_MS
    ) {
      throw new TaskSpecError(
        `${where} has a typing delay outside ${TYPING_DELAY_MIN_MS}–${TYPING_DELAY_MAX_MS} ms`,
      );
    }
  });

  const branchIds = script.branches.map((branch) => branch.id);
  if (new Set(branchIds).size !== branchIds.length) {
    throw new TaskSpecError('branch ids must be unique');
  }
  for (const branch of script.branches) {
    if (!Number.isInteger(branch.turn) || branch.turn < 2 || branch.turn > turnCount) {
      throw new TaskSpecError(`branch "${branch.id}" must apply to a turn from 2 to ${turnCount}`);
    }
    validateCustomerMessage(branch.replacementMessage, `branch "${branch.id}" replacement`);
  }
}

// Parses the script stored on the question-bank row. The stored shape is trusted only after this check.
export const stagedChatServerDataSchema = z.object({
  turns: z.array(
    z.object({
      message: z.string(),
      typingDelayMs: z.number(),
      checkpoints: z.array(z.string()),
      criticalErrors: z.array(z.string()),
    }),
  ),
  branches: z.array(
    z.object({
      id: z.string(),
      turn: z.number(),
      condition: z.string(),
      replacementMessage: z.string(),
    }),
  ),
});

export const stagedChatEnvelopeSchema = z.object({ stagedChat: stagedChatServerDataSchema });
