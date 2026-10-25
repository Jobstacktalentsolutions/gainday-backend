import { z } from 'zod';
import { defineTaskSpec, requireValid } from '../../task-spec';
import { assertCurrency, formatAmount } from '../../finance/finance-format';
import { caseFilePayload, daysBetween, factTable, formatDate, isoDate } from '../case-file';

const dataSchema = z.object({
  currency: z.string().describe('ISO 4217 currency code, e.g. "USD".'),
  customerName: z.string().describe('A fictional customer name.'),
  product: z.string().describe('A common consumer product the customer bought.'),
  orderDate: z.string().describe('Purchase date, YYYY-MM-DD.'),
  requestDate: z.string().describe('Date the customer wrote in, YYYY-MM-DD, on or after orderDate.'),
  orderAmount: z.number().positive(),
  refundWindowDays: z.number().int().min(7).max(60).describe('How long after purchase a refund is accepted.'),
  storeCreditAmount: z
    .number()
    .positive()
    .describe('Store credit an agent may offer without manager approval.'),
  customerMessage: z
    .string()
    .describe('What the customer wrote, in their own words. State no figures: dates and amounts are in the record.'),
});

// Refund outside the window (customer service doc Section 2.1). Eligibility is date arithmetic in
// code; the rubric's checklist and gate follow from that outcome, so they cannot contradict the policy.
export const refundPolicyReplySpec = defineTaskSpec(dataSchema, (data) => {
  assertCurrency(data.currency);
  const order = isoDate(data.orderDate);
  const request = isoDate(data.requestDate);
  requireValid(request >= order, 'the request date is before the order date');

  const days = daysBetween(order, request);
  const outsideWindow = days > data.refundWindowDays;
  const money = (value: number) => formatAmount(value, data.currency);

  const policy = [
    `Refunds are accepted within ${data.refundWindowDays} days of purchase. This order is ${days} days old, so it is ${outsideWindow ? 'outside' : 'inside'} the window.`,
    outsideWindow
      ? 'A refund outside the window needs documented manager approval, which the agent cannot give.'
      : 'A refund inside the window is returned to the original payment method.',
    `Without approval, an agent may offer store credit of up to ${money(data.storeCreditAmount)}.`,
  ].join('\n\n');

  return {
    interfacePayload: caseFilePayload(
      [
        {
          label: 'Customer record',
          content: factTable([
            ['Customer', data.customerName],
            ['Product', data.product],
            ['Order date', formatDate(data.orderDate)],
            ['Order amount', money(data.orderAmount)],
            ['Days since purchase', String(days)],
          ]),
        },
        {
          label: 'Ticket',
          content: `**${data.customerName}, ${formatDate(data.requestDate)}:**\n\n${data.customerMessage}`,
        },
        { label: 'Policy', content: policy },
      ],
      { min: 40, max: 150 },
    ),
    rubric: outsideWindow
      ? {
          checklist: [
            'States that a cash refund is not available for this order under the policy',
            `Offers store credit of up to ${money(data.storeCreditAmount)} as the alternative`,
            'Explains how the customer can use or claim the credit',
            'Gives a next step with a timeframe',
          ],
          gate: `Promises a cash refund for this order, or store credit above ${money(data.storeCreditAmount)}`,
        }
      : {
          checklist: [
            'Confirms the refund is available under the policy',
            'Explains how the refund is processed',
            'Gives a next step with a timeframe',
          ],
          gate: `Promises any amount above the order amount of ${money(data.orderAmount)}`,
        },
  };
});
