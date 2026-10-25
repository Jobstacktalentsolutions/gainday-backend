import { RoleAnchorConfig } from './anchor-role-config.interface';

// Customer service anchors must agree with the policy the candidate was given (customer service doc
// Section 5.2). Weights follow the doc's emphasis on judgment and policy adherence; they are a design
// choice, not a published benchmark.
export const CUSTOMER_SERVICE_ANCHOR_CONFIG: RoleAnchorConfig = {
  criteriaFraming: {
    problemSolving:
      'Did the candidate identify the customer\'s real problem and reach a resolution that fits it, asking for or using the information that matters?',
    judgmentExecution:
      'Did the candidate apply the policy correctly: no unauthorised commitment, refusal of improper requests, escalation at the right time, and a next step with timing?',
    writtenCommunication:
      'Is the reply specific rather than templated, clear, plain-language, and within the channel\'s length, with a structure the customer can act on?',
    commercialDomainAwareness:
      'Does the response weigh what the policy protects against what the customer is worth, and recognise legal, safety or data-risk situations?',
  },
  categoryWeights: {
    problemSolving: 0.25,
    judgmentExecution: 0.35,
    writtenCommunication: 0.25,
    commercialDomainAwareness: 0.15,
  },
  anchorCorrectnessPrompt: `You are validating anchor responses generated for a customer service job-simulation task.
The task's Policy tab and gate are the only rules that apply. Judge each anchor by its score band:

- Score 70 or above: sound only if every refund, credit, compensation or escalation it promises is authorised
  by the policy shown (within any stated amount), it does not trigger the gate, and the checklist items it
  claims to meet are actually met.
- Score below 70: the anchor is meant to show a flaw. Unauthorised promises, missed checklist items and a
  triggered gate are expected here, not faults. Sound only if the flaw it shows is one the policy supports
  (for example, an offer above the stated limit) and the anchor is internally consistent. An anchor that
  invents policy the Policy tab does not state is unsound.

Review the task and its anchor responses. For EACH anchor (indexed 0-based, in the order given), report in
anchorFeedback whether it is sound under its band, and if not, exactly what is wrong. Set issue to null for
sound anchors. The top-level "sound" field is true only if every anchor is sound.`,
};
