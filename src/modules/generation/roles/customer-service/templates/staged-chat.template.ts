import { z } from 'zod';
import { defineTaskSpec, requireValid } from '../../task-spec';
import { factTable } from '../case-file';
import {
  StagedChatServerData,
  TYPING_DELAY_MAX_MS,
  TYPING_DELAY_MIN_MS,
  validateStagedScript,
} from '../staged-chat/staged-script';

const dataSchema = z.object({
  displayName: z.string().describe('The customer as the candidate sees them, e.g. "Priya S." Fictional.'),
  customerRecord: z
    .array(
      z.object({
        field: z.string().describe('A record field, e.g. "Plan" or "Account since".'),
        value: z.string(),
      }),
    )
    .min(3)
    .max(6),
  ticketHistory: z
    .string()
    .describe('Earlier tickets and notes, GitHub-flavored Markdown. Figures only as the record states them.'),
  policy: z
    .string()
    .describe('The policy that applies, as Markdown. The only rules the candidate may use.'),
  wordLimit: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
  }),
  turnCount: z
    .number()
    .int()
    .describe('3 or 4. Use 4 only when the case has a distinct final step, such as setting expectations after an escalation.'),
  turns: z
    .array(
      z.object({
        message: z
          .string()
          .describe(
            'The customer message for this turn. Must not refer to what the agent said or wrote.',
          ),
        typingDelayMs: z
          .number()
          .int()
          .describe(`Typing delay before the message appears, ${TYPING_DELAY_MIN_MS} to ${TYPING_DELAY_MAX_MS} ms.`),
        checkpoints: z
          .array(z.string())
          .min(1)
          .max(4)
          .describe('What a good reply to this message does. Never shown to the candidate.'),
        criticalErrors: z
          .array(z.string())
          .max(3)
          .describe('What a reply to this message must not do. Never shown to the candidate.'),
      }),
    )
    .min(3)
    .max(4),
  branches: z
    .array(
      z.object({
        id: z.string().describe('Unique within the task, e.g. "escalates".'),
        turn: z.number().int().describe('The turn (2 or later) whose customer message this replaces.'),
        condition: z.string().describe('When this branch applies, in words. Documentation only.'),
        replacementMessage: z.string(),
      }),
    )
    .max(3)
    .describe('Optional. Empty for most tasks.'),
});

// Staged chat (customer service doc Section 2.8). The model writes the scripted customer messages and
// the grading checkpoints; code builds the visible case file and the strict payload, and validates the
// script against the spec's rules before anything is stored.
export const stagedChatSpec = defineTaskSpec(dataSchema, (data) => {
  requireValid(data.wordLimit.min <= data.wordLimit.max, 'the word limit minimum is above its maximum');

  const tabs = [
    {
      label: 'Customer record',
      content: factTable(data.customerRecord.map((fact) => [fact.field, fact.value])),
    },
    { label: 'Ticket history', content: data.ticketHistory },
    { label: 'Policy', content: data.policy },
  ];
  const caseFileText = [data.displayName, ...tabs.map((tab) => tab.content)].join('\n');

  const serverData: StagedChatServerData = {
    turns: data.turns,
    branches: data.branches,
  };
  validateStagedScript(serverData, data.turnCount, caseFileText);

  return {
    interfacePayload: {
      displayName: data.displayName,
      caseFile: { tabs },
      wordLimit: data.wordLimit,
      turnCount: data.turnCount,
      placeholder: null,
    },
    serverOnly: { stagedChat: serverData },
  };
});
