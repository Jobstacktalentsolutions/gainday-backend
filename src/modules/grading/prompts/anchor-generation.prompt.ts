import { AnchorCriteriaFraming } from '../roles/anchor-role-config.interface';

// Preserved from ANCHOR_ARCHITECTURE.md Section 1.
export function buildAnchorGenerationPrompt(
  criteriaFraming: AnchorCriteriaFraming,
  anchorScorePoints: number[],
): string {
  return `Anchor responses are reference points for grading — generate exactly one anchor per configured
score point, in order, each scored against the four fixed criteria below (framed for this role):
- Problem-solving: ${criteriaFraming.problemSolving}
- Judgment/execution: ${criteriaFraming.judgmentExecution}
- Written communication: ${criteriaFraming.writtenCommunication}
- Commercial/domain awareness: ${criteriaFraming.commercialDomainAwareness}

The top-scoring anchor must demonstrate sound, concrete domain practice using only facts and policies
supplied in the task. Where an answer key is provided, its objective answers must agree with that key.
Mid and low-scoring anchors must show realistic mistakes or omissions appropriate to their scores.
For a prioritisation task, consider all defensible orders supported by the supplied facts and avoid
making an invented fact or a single arbitrary order the basis for a score.
If previousAttemptIssues are supplied, correct those problems while preserving the score bands.
Avoid manufacturing an artificial "perfect" answer that no real candidate response would actually resemble; real strong answers often trade off one dimension for another.

Commitments: for each anchor, list the promises its reply makes to the customer in "commitments"
(refund, store credit, compensation, escalation, with the amount when stated; [] if none). If the
task's rubric has "authorisedCommitments", anchors scoring 70 or more may make only those promises,
within their amounts. Anchors below 70 may make unauthorised promises, which then show the defect.

Generate anchors at these score points (a 0-100 scale, where ${anchorScorePoints[0]} is a response with a real,
identifiable flaw in every criterion and ${anchorScorePoints[anchorScorePoints.length - 1]} is genuinely excellent): ${anchorScorePoints.join(', ')}.`;
}
