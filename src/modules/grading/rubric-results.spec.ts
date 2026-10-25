import { checklistResults, gateOutcome } from './rubric-results';

describe('rubric results', () => {
  const rubric = { checklist: ['Offers the credit', 'Gives a timeframe'], gate: 'Promises a refund' };

  it('names each checklist mark after the task text, not the model', () => {
    expect(
      checklistResults(rubric, {
        checklist: [
          { met: true, evidence: 'store credit of $25' },
          { met: false, evidence: '' },
        ],
      }),
    ).toEqual([
      { item: 'Offers the credit', met: true, evidence: 'store credit of $25' },
      { item: 'Gives a timeframe', met: false, evidence: '' },
    ]);
  });

  it('fails when the marks do not line up with the checklist', () => {
    expect(() => checklistResults(rubric, { checklist: [{ met: true, evidence: '' }] })).toThrow();
  });

  it('reads the gate from the grader only when the task has one', () => {
    expect(gateOutcome(undefined, {})).toBeNull();
    expect(gateOutcome({ checklist: [], gate: null }, {})).toBeNull();
    expect(gateOutcome(rubric, { gateTriggered: true })).toEqual({
      triggered: true,
      description: 'Promises a refund',
    });
    expect(() => gateOutcome(rubric, {})).toThrow();
  });
});
