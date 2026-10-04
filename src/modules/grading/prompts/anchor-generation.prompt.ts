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

The top-scoring anchor (highest score point) MUST demonstrate sound, concrete domain strategy (e.g. in sales/negotiation: protecting deal value, proposing alternative concessions like longer terms or added services rather than giving unconditional discounts).
Mid and low-scoring anchors MUST reflect real candidate pitfalls (e.g. defaulting to price cuts, generic platitudes without a clear counter-strategy, or missing key trade-offs).
Avoid manufacturing an artificial "perfect" answer that no real candidate response would actually resemble; real strong answers often trade off one dimension for another.

Generate anchors at these score points: ${anchorScorePoints.join(', ')}.`;
}
