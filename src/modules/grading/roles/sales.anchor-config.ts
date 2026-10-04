import { RoleAnchorConfig } from './anchor-role-config.interface';

// Criteria framing and correctness prompt preserved verbatim from ANCHOR_ARCHITECTURE.md
// Sections 1 and 3 (the design that was live in generation through 2026-08-30).
export const SALES_ANCHOR_CONFIG: RoleAnchorConfig = {
  criteriaFraming: {
    problemSolving:
      'Did the candidate correctly read the sales situation (e.g. which lever actually matters — deal size vs. urgency vs. probability to close; stalling vs. genuine hesitation) and apply sound sales reasoning rather than a generic playbook response?',
    judgmentExecution:
      'Did the candidate make the right sales judgment call — e.g. acknowledging an objection before countering it, protecting deal value via strategic counter-proposals (such as longer contract terms, added services, or phased implementation) instead of defaulting to a discount, and choosing a single clear call-to-action or next step?',
    writtenCommunication:
      'Is the written email/message/plan clear, appropriately concise, and free of generic mass-outreach or reassurance-language tells that a real buyer would recognize and discount?',
    commercialDomainAwareness:
      'Does the response reflect real understanding of the buyer/deal context — speaking to a specific pain point rather than product features, correctly identifying stakeholder roles, or reasoning about deal economics — rather than a generic, could-apply-to-any-deal answer?',
  },
  categoryWeights: {
    problemSolving: 0.25,
    judgmentExecution: 0.25,
    writtenCommunication: 0.25,
    commercialDomainAwareness: 0.25,
  },
  anchorCorrectnessPrompt: `You are validating anchor responses generated for a sales job-simulation task across score points.
Sales anchors must reflect appropriate quality for their assigned score points:
- TOP-SCORING anchors (high score points e.g. 8-10) MUST demonstrate sound, defensible sales practice (e.g. protecting deal value via structured counter-strategies like contract length, added services, or phased rollouts instead of blanket price cuts).
- LOW/MID-SCORING anchors (low score points e.g. 0-5) SHOULD demonstrate realistic candidate mistakes or weak execution (e.g. defaulting to price discounts, offering generic platitudes, or failing to protect margin). Do NOT reject low-scoring anchors for having weak sales practice — that is expected for a low score!
- Reject an anchor ONLY if its content quality does NOT match its assigned score point (e.g. an anchor scored 10/10 that defaults to a discount, or an anchor scored 0/10 that is actually a strong answer).

Review the task and its anchor responses. For EACH anchor (indexed 0-based, in the order given), report in anchorFeedback whether its response quality matches its assigned score point, and if not, exactly what is wrong. Set issue to null for sound anchors. The top-level "sound" field is true only if every anchor is sound.`,
};
