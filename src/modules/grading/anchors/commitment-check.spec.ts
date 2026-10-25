import type { AnchorResponse, TaskRubric } from '../../../db/schema/question-bank.schema';
import { unauthorisedCommitmentReasons } from './commitment-check';

const criteria = {
  problemSolving: '',
  judgmentExecution: '',
  writtenCommunication: '',
  commercialDomainAwareness: '',
};

function anchor(score: number, commitments: AnchorResponse['commitments']): AnchorResponse {
  return { score, commitments, responseText: 'Reply', criteria };
}

const rubric: TaskRubric = {
  checklist: [],
  gate: null,
  authorisedCommitments: [
    { kind: 'STORE_CREDIT', amount: 25 },
    { kind: 'ESCALATION', amount: null },
  ],
};

describe('unauthorisedCommitmentReasons', () => {
  it('passes a high anchor that promises only authorised credit and escalation', () => {
    const reasons = unauthorisedCommitmentReasons(
      [anchor(100, [{ kind: 'STORE_CREDIT', amount: 25 }, { kind: 'ESCALATION', amount: null }])],
      rubric,
    );
    expect(reasons).toEqual([]);
  });

  it('flags a high anchor that promises a cash refund the policy does not give', () => {
    const reasons = unauthorisedCommitmentReasons(
      [anchor(80, [{ kind: 'CASH_REFUND', amount: null }])],
      rubric,
    );
    expect(reasons).toEqual(['The 80 anchor promises a cash refund, which the policy does not authorise.']);
  });

  it('flags store credit above the authorised amount', () => {
    const reasons = unauthorisedCommitmentReasons(
      [anchor(100, [{ kind: 'STORE_CREDIT', amount: 40 }])],
      rubric,
    );
    expect(reasons).toEqual(['The 100 anchor promises store credit of 40, which the policy does not authorise.']);
  });

  it('does not check low anchors, which may show the defect', () => {
    const reasons = unauthorisedCommitmentReasons(
      [anchor(40, [{ kind: 'CASH_REFUND', amount: 120 }]), anchor(60, [])],
      rubric,
    );
    expect(reasons).toEqual([]);
  });

  it('checks nothing when the task has no authorised list', () => {
    expect(
      unauthorisedCommitmentReasons([anchor(100, [{ kind: 'CASH_REFUND', amount: 999 }])], {
        checklist: [],
        gate: null,
      }),
    ).toEqual([]);
  });

  it('treats an empty authorised list as no commitments allowed', () => {
    const reasons = unauthorisedCommitmentReasons(
      [anchor(100, [{ kind: 'ESCALATION', amount: null }])],
      { checklist: [], gate: null, authorisedCommitments: [] },
    );
    expect(reasons).toHaveLength(1);
  });
});
