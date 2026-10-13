import type { GuestInfo } from '../../db/schema';

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
  guestInfo: GuestInfo | null;
}

/**
 * Who to contact for a submission: the registered candidate's account, or the details a guest
 * entered. Null when the submission carries neither.
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
  if (submission.guestInfo) {
    return {
      fullName: submission.guestInfo.fullName,
      email: submission.guestInfo.email,
      phoneNumber: submission.guestInfo.phoneNumber ?? null,
    };
  }
  return null;
}
