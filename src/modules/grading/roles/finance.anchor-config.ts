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
  categoryWeights: {
    problemSolving: 0.4,
    judgmentExecution: 0.3,
    writtenCommunication: 0.1,
    commercialDomainAwareness: 0.2,
  },
  anchorCorrectnessPrompt: `Review finance anchors against their assigned score and the supplied task.
High-scoring responses must use correct calculations, defensible accounting and the answer key where
provided. Low and middle responses may contain plausible mistakes or omissions appropriate to their
scores; do not reject them merely for being incorrect. Reject an anchor if its quality does not fit
its score. For each strong answer, compare its claimed facts, approvals and instructions with the task:
reject it if it asserts a material employer directive or policy that the task does not provide.
For each anchor, report its zero-based index, whether it is sound for its score, and a specific issue
or null. Set the top-level sound to true only if every anchor is sound.`,
};
