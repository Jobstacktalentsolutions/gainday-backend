import { TaskSpecError } from '../../role-module.interface';
import { refundPolicyReplySpec } from './refund-policy-reply.template';
import { diagnosticQuestionsSpec } from './diagnostic-questions.template';
import { ticketTriageSpec } from './ticket-triage.template';

type Tab = { label: string; content: string };

const refundInput = {
  currency: 'USD',
  customerName: 'Priya Shah',
  product: 'Wireless headphones',
  orderDate: '2027-03-01',
  requestDate: '2027-03-11',
  orderAmount: 120,
  refundWindowDays: 30,
  storeCreditAmount: 25,
  customerMessage: 'I want my money back, I changed my mind.',
};

describe('refundPolicyReplySpec', () => {
  it('derives an outside-window outcome: no cash refund, store credit as the alternative', () => {
    // The order is 10 days old, so a 7-day window puts it outside.
    const { rubric } = refundPolicyReplySpec.materialize({ ...refundInput, refundWindowDays: 7 });
    expect(rubric?.checklist).toContain(
      'States that a cash refund is not available for this order under the policy',
    );
    expect(rubric?.gate).toBe('Promises a cash refund for this order, or store credit above $25.00');
  });

  it('derives an inside-window outcome: the refund is confirmed', () => {
    const { rubric } = refundPolicyReplySpec.materialize(refundInput);
    expect(rubric?.checklist[0]).toBe('Confirms the refund is available under the policy');
  });

  it('states the window and the day count from the inputs in the policy tab', () => {
    const { interfacePayload } = refundPolicyReplySpec.materialize({ ...refundInput, refundWindowDays: 7 });
    const tabs = (interfacePayload.caseFile as { tabs: Tab[] }).tabs;
    const policy = tabs.find((tab) => tab.label === 'Policy')?.content ?? '';
    expect(policy).toContain('within 7 days of purchase');
    expect(policy).toContain('10 days old, so it is outside the window');
  });

  it('rejects a request dated before the order', () => {
    expect(() =>
      refundPolicyReplySpec.materialize({ ...refundInput, requestDate: '2027-02-01' }),
    ).toThrow(TaskSpecError);
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    expect(() =>
      refundPolicyReplySpec.materialize({ ...refundInput, requestDate: '11/03/2027' }),
    ).toThrow(TaskSpecError);
  });
});

describe('diagnosticQuestionsSpec', () => {
  const causes = [{ label: 'Expired card' }, { label: 'Browser cache' }, { label: 'Account locked' }];

  it('keys the one pair of questions that separates all three causes', () => {
    const { objectiveComponent } = diagnosticQuestionsSpec.materialize({
      customerName: 'Sam',
      product: 'Billing',
      symptomReport: 'It is not working.',
      causes,
      questions: [
        { text: 'Did the payment fail?', answers: ['yes', 'yes', 'no'] },
        { text: 'Does the error mention a card?', answers: ['yes', 'no', 'no'] },
        { text: 'Which browser are you using?', answers: ['same', 'same', 'same'] },
        { text: 'What time is it?', answers: ['late', 'late', 'late'] },
        { text: 'Is the screen dark?', answers: ['dark', 'dark', 'dark'] },
      ],
    });
    expect(objectiveComponent).toMatchObject({ selectCount: 2, correctOptionIndices: [0, 1] });
  });

  it('rejects a task with more than one separating pair, so the key is never ambiguous', () => {
    expect(() =>
      diagnosticQuestionsSpec.materialize({
        customerName: 'Sam',
        product: 'Billing',
        symptomReport: 'It is not working.',
        causes,
        questions: [
          { text: 'A?', answers: ['a', 'b', 'a'] },
          { text: 'B?', answers: ['a', 'a', 'b'] },
          { text: 'C?', answers: ['c', 'd', 'c'] },
          { text: 'D?', answers: ['e', 'e', 'f'] },
          { text: 'E?', answers: ['g', 'g', 'g'] },
        ],
      }),
    ).toThrow(TaskSpecError);
  });
});

describe('ticketTriageSpec', () => {
  type Ticket = {
    id: string;
    summary: string;
    tier: 'VIP' | 'STANDARD' | 'BASIC';
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    slaHoursLeft: number;
    needsSpecialist: boolean;
  };
  const ticket = (id: string, overrides: Partial<Ticket> = {}): Ticket => ({
    id,
    summary: `Issue ${id}`,
    tier: 'STANDARD',
    impact: 'LOW',
    slaHoursLeft: 30,
    needsSpecialist: false,
    ...overrides,
  });

  it('works the highest-scoring ticket first and assigns the other actions by rule', () => {
    const { objectiveComponent } = ticketTriageSpec.materialize({
      tickets: [
        ticket('T-1', { tier: 'VIP', impact: 'HIGH', slaHoursLeft: 2 }), // 30+30+22 = 82
        ticket('T-2', { needsSpecialist: true }), // Escalate
        ticket('T-3', { slaHoursLeft: 3, impact: 'MEDIUM' }), // Reply now
        ticket('T-4', { impact: 'MEDIUM', slaHoursLeft: 20 }), // Holding reply
        ticket('T-5', { impact: 'LOW', slaHoursLeft: 20 }), // Defer
      ],
    });
    expect(objectiveComponent?.correctMapping).toEqual([
      { item: 'T-1', bucket: 'Work first' },
      { item: 'T-2', bucket: 'Escalate' },
      { item: 'T-3', bucket: 'Reply now' },
      { item: 'T-4', bucket: 'Holding reply' },
      { item: 'T-5', bucket: 'Defer' },
    ]);
  });

  it('rejects a queue with a tie for the first pick', () => {
    expect(() =>
      ticketTriageSpec.materialize({ tickets: [ticket('T-1'), ticket('T-2'), ticket('T-3')] }),
    ).toThrow(TaskSpecError);
  });
});
