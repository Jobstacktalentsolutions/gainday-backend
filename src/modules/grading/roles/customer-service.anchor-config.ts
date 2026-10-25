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
The task's Policy tab and gate are the only rules that apply. An anchor is sound only if:
- every refund, credit, timeline or escalation it promises is authorised by the policy shown;
- its stated outcome matches the task's checklist (it meets the items it claims to meet and misses the rest);
- a high-scoring anchor (80 or above) does not trigger the task's gate, and a low-scoring anchor that does
  trigger it is labelled as the critical error it is.
Review the task and its anchor responses. For EACH anchor (indexed 0-based, in the order given), report in
anchorFeedback whether it is sound, and if not, exactly what is wrong. Set issue to null for sound anchors.
The top-level "sound" field is true only if every anchor is sound.`,
};
