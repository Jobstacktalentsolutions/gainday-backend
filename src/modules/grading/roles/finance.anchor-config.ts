import { RoleAnchorConfig } from './anchor-role-config.interface';

// Criteria framing and correctness prompt preserved verbatim from ANCHOR_ARCHITECTURE.md
// Sections 1 and 3 (the design that was live in generation through 2026-08-30).
export const FINANCE_ANCHOR_CONFIG: RoleAnchorConfig = {
  criteriaFraming: {
    problemSolving:
      'Did the candidate correctly identify the financial issue and apply sound quantitative reasoning?',
    judgmentExecution:
      'Did the candidate follow correct financial procedure and execute the calculation/analysis without material error?',
    writtenCommunication:
      'Is the written analysis/communication clear, precise, and appropriately structured for a finance audience?',
    commercialDomainAwareness:
      'Does the response reflect real understanding of financial/commercial implications (e.g. materiality, risk, compliance) rather than mechanical calculation alone?',
  },
  anchorCorrectnessPrompt: `You are validating anchor responses generated for a finance job-simulation task.
Finance anchors must be numerically and procedurally sound: any stated calculation must be
arithmetically correct, any referenced accounting/finance procedure must reflect real,
defensible practice, and classification/sequencing answers must reflect a genuinely correct
order or bucket — not merely a plausible-sounding one.

Review the task and its anchor responses. For EACH anchor (indexed 0-based, in the order given),
report in anchorFeedback whether it is sound, and if not, exactly what is wrong (e.g. "the stated
total is off by $200", "score doesn't match reasoning quality — this reads like a 5/10 answer but
is scored 10"). Set issue to null for sound anchors. The top-level "sound" field is true only if
every anchor is sound.`,
};
