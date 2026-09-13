import { RoleAnchorConfig } from './anchor-role-config.interface';

// Criteria framing and correctness prompt preserved verbatim from ANCHOR_ARCHITECTURE.md
// Sections 1 and 3 (the design that was live in generation through 2026-08-30).
export const SALES_ANCHOR_CONFIG: RoleAnchorConfig = {
  criteriaFraming: {
    problemSolving:
      'Did the candidate correctly read the sales situation (e.g. which lever actually matters — deal size vs. urgency vs. probability to close; stalling vs. genuine hesitation) and apply sound sales reasoning rather than a generic playbook response?',
    judgmentExecution:
      'Did the candidate make the right sales judgment call — e.g. acknowledging an objection before countering it, protecting deal value instead of defaulting to a discount, choosing a single clear call-to-action or next step rather than a vague one?',
    writtenCommunication:
      'Is the written email/message/plan clear, appropriately concise, and free of generic mass-outreach or reassurance-language tells that a real buyer would recognize and discount?',
    commercialDomainAwareness:
      'Does the response reflect real understanding of the buyer/deal context — speaking to a specific pain point rather than product features, correctly identifying stakeholder roles, or reasoning about deal economics — rather than a generic, could-apply-to-any-deal answer?',
  },
  anchorCorrectnessPrompt: `You are validating anchor responses generated for a sales job-simulation task.
Sales anchors must reflect sound, defensible sales practice, not just plausible-sounding prose:
- An objection-handling or closing anchor must acknowledge the prospect's actual concern before
  countering it, avoid generic reassurance language ("I hear you, but..." with no substance), and
  move toward a concrete next step rather than just defending the product or defaulting to a discount.
- A cold outreach anchor must speak to a real, specific pain point rather than listing product
  features, and end with a single clear call-to-action — not a vague "let me know if interested."
- A pipeline-prioritization anchor's ordering and justification must actually follow from the
  deal attributes given (size, urgency, stage, probability to close) — not just assert a
  reasonable-sounding priority without the reasoning matching the underlying data.
- An account-planning anchor must correctly identify the distinct buyer roles present in the
  scenario (e.g. economic buyer vs. technical evaluator) and sequence the approach logically.

Review the task and its anchor responses. For EACH anchor (indexed 0-based, in the order given),
report in anchorFeedback whether it is sound, and if not, exactly what is wrong (e.g. "defaults
to a discount instead of protecting deal value", "score doesn't match reasoning quality — this
reads like a 5/10 answer but is scored 10"). Set issue to null for sound anchors. The top-level
"sound" field is true only if every anchor is sound.`,
};
