import type { AnchorResponse, Commitment, TaskRubric } from '../../../db/schema/question-bank.schema';

/** Anchors at or above this score may make only the commitments the policy authorises. On the
 *  0-100 scale this is the customer service doc's "7 or above". */
export const COMMITMENT_CHECK_MIN_SCORE = 70;

const KIND_LABELS: Record<Commitment['kind'], string> = {
  CASH_REFUND: 'a cash refund',
  STORE_CREDIT: 'store credit',
  COMPENSATION: 'compensation',
  ESCALATION: 'an escalation',
};

/** A commitment is authorised when the policy allows its kind, and its amount, when it states one,
 *  is within the authorised limit. A commitment with no amount is not restricted by an amount. */
function isAuthorised(commitment: Commitment, authorised: Commitment[]): boolean {
  return authorised.some(
    (allowed) =>
      allowed.kind === commitment.kind &&
      (commitment.amount === null || allowed.amount === null || commitment.amount <= allowed.amount),
  );
}

/**
 * Commitments that high-scoring anchors make beyond the policy (customer service doc Section 5.3).
 * Returns one reason per unauthorised commitment; an empty array passes. A task without an
 * `authorisedCommitments` list is not checked.
 */
export function unauthorisedCommitmentReasons(
  anchors: AnchorResponse[],
  rubric: TaskRubric | undefined,
): string[] {
  if (!rubric || !rubric.authorisedCommitments) return [];
  const authorised = rubric.authorisedCommitments;

  return anchors
    .filter((anchor) => anchor.score >= COMMITMENT_CHECK_MIN_SCORE)
    .flatMap((anchor) =>
      (anchor.commitments ?? [])
        .filter((commitment) => !isAuthorised(commitment, authorised))
        .map((commitment) => {
          const amount = commitment.amount === null ? '' : ` of ${commitment.amount}`;
          return `The ${anchor.score} anchor promises ${KIND_LABELS[commitment.kind]}${amount}, which the policy does not authorise.`;
        }),
    );
}
