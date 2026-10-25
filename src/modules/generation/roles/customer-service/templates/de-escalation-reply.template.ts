import { z } from 'zod';
import { defineTaskSpec } from '../../task-spec';
import { assertCurrency, formatAmount } from '../../finance/finance-format';
import { caseFilePayload, factTable } from '../case-file';

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  customerName: z.string().describe('A fictional customer name.'),
  product: z.string().describe('A common consumer product or service.'),
  intensity: z
    .enum(['FRUSTRATED', 'ABUSIVE'])
    .describe('FRUSTRATED: angry but civil. ABUSIVE: insulting, but no slurs, threats of violence, or content about protected groups.'),
  threat: z
    .enum(['NONE', 'BAD_REVIEW', 'CHARGEBACK', 'SAFETY'])
    .describe('The customer threatens a bad review, a chargeback, a safety risk, or nothing.'),
  compensationLimit: z
    .number()
    .positive()
    .describe('Compensation an agent may offer without approval.'),
  customerMessage: z
    .string()
    .describe('The escalated message, mild in tone. State no figures.'),
});

// De-escalation and boundary-setting (customer service doc Section 2.2). The policy tab is the only
// rule set: the gate and checklist name the behaviours it allows and forbids.
export const deEscalationReplySpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  const money = (value: number) => formatAmount(value, data.currency);

  const checklist = [
    "Acknowledges the customer's problem before explaining anything",
    'Offers one concrete next step with a timeframe',
    data.intensity === 'ABUSIVE'
      ? 'Sets a calm boundary on the abusive language without mirroring it'
      : "Does not mirror the customer's anger or defensiveness",
  ];
  if (data.threat !== 'NONE') {
    checklist.push('Passes the threat to the specialist team instead of handling it alone');
  }

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
        { label: 'Ticket', content: `**${data.customerName}:**\n\n${data.customerMessage}` },
        {
          label: 'Policy',
          content: [
            `Agents may offer compensation of up to ${money(data.compensationLimit)} without approval.`,
            'Abusive language is not tolerated: an agent may set a calm boundary and close the chat.',
            'Threats of a chargeback, a safety risk or legal action go to the specialist team.',
          ].join('\n\n'),
        },
      ],
      { min: 30, max: 120 },
    ),
    rubric: {
      checklist,
      gate: `Mirrors abusive language, or promises compensation above ${money(data.compensationLimit)}`,
    },
  };
});
