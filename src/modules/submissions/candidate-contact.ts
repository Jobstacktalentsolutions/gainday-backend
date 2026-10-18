export interface CandidateContact {
  fullName: string;
  email: string;
  phoneNumber: string | null;
}

interface SubmissionWithIdentity {
  candidate: {
    fullName: string;
    phoneNumber: string | null;
    user: { email: string };
  } | null;
}

/**
 * Who to contact for a submission: the candidate's account. Null when the candidate's account
 * has since been deleted.
 */
export function resolveCandidateContact(
  submission: SubmissionWithIdentity,
): CandidateContact | null {
  if (submission.candidate) {
    return {
      fullName: submission.candidate.fullName,
      email: submission.candidate.user.email,
      phoneNumber: submission.candidate.phoneNumber,
    };
  }
  return null;
}
