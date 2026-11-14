import { refundPolicyReplySpec } from './refund-policy-reply.template';
import { deEscalationReplySpec } from './de-escalation-reply.template';

const refundInput = {
  currency: 'USD',
  customerName: 'Priya Shah',
  product: 'Wireless headphones',
  orderDate: '2027-03-01',
  requestDate: '2027-03-11',
  orderAmount: 120,
  refundWindowDays: 7,
  storeCreditAmount: 25,
  customerMessage: 'I want my money back.',
};

describe('authorised commitments in customer service templates', () => {
  it('authorises store credit and escalation, not a cash refund, outside the window', () => {
    const { rubric } = refundPolicyReplySpec.materialize(refundInput);
    expect(rubric?.authorisedCommitments).toEqual([
      { kind: 'STORE_CREDIT', amount: 25 },
      { kind: 'ESCALATION', amount: null },
    ]);
  });

  it('authorises both the refund and the policy credit inside the window', () => {
    const { rubric } = refundPolicyReplySpec.materialize({ ...refundInput, refundWindowDays: 30 });
    expect(rubric?.authorisedCommitments).toEqual([
      { kind: 'CASH_REFUND', amount: 120 },
      { kind: 'STORE_CREDIT', amount: 25 },
    ]);
    expect(rubric?.gate).toBe('Promises a cash refund above $120.00, or store credit above $25.00');
  });

  it('authorises compensation only, unless the customer makes a threat', () => {
    const base = {
      currency: 'USD',
      customerName: 'Sam',
      product: 'Broadband',
      intensity: 'FRUSTRATED' as const,
      compensationLimit: 15,
      customerMessage: 'This is unacceptable.',
    };
    expect(deEscalationReplySpec.materialize({ ...base, threat: 'NONE' }).rubric?.authorisedCommitments).toEqual([
      { kind: 'COMPENSATION', amount: 15 },
    ]);
    expect(
      deEscalationReplySpec.materialize({ ...base, threat: 'CHARGEBACK' }).rubric?.authorisedCommitments,
    ).toEqual([
      { kind: 'COMPENSATION', amount: 15 },
      { kind: 'ESCALATION', amount: null },
    ]);
  });
});
