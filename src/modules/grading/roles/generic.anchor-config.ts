import { RoleAnchorConfig } from './anchor-role-config.interface';

// Counterpart to generation's GenericRoleModule (see
// src/modules/generation/roles/generic/generic.role-module.ts) for any question_bank category
// with no purpose-built anchor config. We can't hand-write per-domain criteria framing ahead of
// time for every possible category, so — like the generation-side module — this trades
// hand-tuned precision for coverage: instead of a fixed definition per criterion, it instructs
// the anchor-generation/grading model to interpret each criterion using its own domain knowledge
// of whatever category string it's given at call time.
export const GENERIC_ANCHOR_CONFIG: RoleAnchorConfig = {
  criteriaFraming: {
    problemSolving:
      'Using your own knowledge of what this specific role/category actually involves, did the ' +
      'candidate correctly identify the real problem in the scenario and reason about it the way ' +
      'a genuine practitioner in this field would — not just a generically sensible-sounding answer?',
    judgmentExecution:
      'Judging by real practice in this specific field (not a generic standard), did the candidate ' +
      'make the right call and execute it soundly, without a material error a real practitioner ' +
      'would catch?',
    writtenCommunication:
      'Is the written response clear, appropriately structured, and pitched at the register a real ' +
      'audience in this field would expect?',
    commercialDomainAwareness:
      "Does the response reflect real, specific understanding of this field's practical stakes " +
      '(what actually matters to someone doing this job) rather than a could-apply-to-any-job answer?',
  },
  anchorCorrectnessPrompt: `You are validating anchor responses generated for a job-simulation task
in a category with no pre-built anchor template. Using your own general and industry-specific
knowledge of what this category ("category" field on the task) actually involves, judge whether
each anchor response is sound: does it reflect real, defensible practice in that specific field,
scored consistently with its stated score (a "10/10" anchor should read like genuine strong
performance in that field, not just confident prose; a "0/10" anchor should have a real,
identifiable flaw a practitioner would catch)?

Review the task and its anchor responses. For EACH anchor (indexed 0-based, in the order given),
report in anchorFeedback whether it is sound, and if not, exactly what is wrong. Set issue to null
for sound anchors. The top-level "sound" field is true only if every anchor is sound.`,
};
