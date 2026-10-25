import { z } from 'zod';
import { defineTaskSpec, requireValid } from '../../task-spec';
import { caseFilePayload, factTable, formatDate, isoDate } from '../case-file';

const dataSchema = z.object({
  customerName: z.string().describe('A fictional customer name.'),
  product: z.string().describe('A common consumer product or service.'),
  thread: z
    .array(
      z.object({
        from: z.enum(['CUSTOMER', 'AGENT']),
        text: z.string().describe('The message. State no figures.'),
      }),
    )
    .min(6)
    .max(10)
    .describe('The prior messages and notes, in order.'),
  requiredFacts: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe('Facts the handoff must contain, each stated as a short fact (e.g. "the customer was charged twice").'),
  receivingTeam: z.string().describe('The team the case goes to, e.g. "Billing".'),
  deadline: z.string().describe('When the receiving team must act, YYYY-MM-DD.'),
});

// Escalation and handoff (customer service doc Section 2.5). The checklist is the required facts plus
// the deadline and the ask, so a handoff can be checked for completeness without guessing.
export const escalationHandoffSpec = defineTaskSpec(dataSchema, (data) => {
  requireValid(data.requiredFacts.length >= 3, 'a handoff needs at least three required facts');
  isoDate(data.deadline);

  const thread = data.thread
    .map((message) => `**${message.from === 'CUSTOMER' ? data.customerName : 'Agent'}:** ${message.text}`)
    .join('\n\n');

  return {
    interfacePayload: caseFilePayload(
      [
        {
          label: 'Customer record',
          content: factTable([
            ['Customer', data.customerName],
            ['Product', data.product],
          ]),
        },
        { label: 'Thread', content: thread },
        {
          label: 'Handoff brief',
          content: factTable([
            ['Receiving team', data.receivingTeam],
            ['Deadline', formatDate(data.deadline)],
          ]),
        },
      ],
      { min: 40, max: 110 },
    ),
    rubric: {
      checklist: [
        ...data.requiredFacts.map((fact) => `Includes this fact: ${fact}`),
        `States the deadline: ${formatDate(data.deadline)}`,
        `Makes a clear ask of ${data.receivingTeam}`,
        'Does not blame the customer',
      ],
      gate: null,
    },
  };
});
