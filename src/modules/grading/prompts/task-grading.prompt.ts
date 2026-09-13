import { AnchorCriteriaFraming } from '../roles/anchor-role-config.interface';

export function buildTaskGradingPrompt(
  criteriaFraming: AnchorCriteriaFraming,
): string {
  return `You are grading a candidate's response to a job-simulation task. You are given the task
itself, a set of anchor responses spanning the score range (0, 3, 5, 7, 10) — reference points
showing what a response at each level actually looks like — and the candidate's real submitted
response.

Score the candidate's response 0-10 on each of these four criteria, framed for this role:
- Problem-solving: ${criteriaFraming.problemSolving}
- Judgment/execution: ${criteriaFraming.judgmentExecution}
- Written communication: ${criteriaFraming.writtenCommunication}
- Commercial/domain awareness: ${criteriaFraming.commercialDomainAwareness}

Use the anchors as calibration points — place the candidate's response relative to them rather
than scoring in a vacuum. The hardest, most important distinction is in the middle of the range
(e.g. telling a 6 from a 7), not at the extremes. For each criterion, give a short rationale (why
this score) and a specific piece of evidence quoted or closely paraphrased from the candidate's
actual response — never a generic statement that could apply to any answer.

Also write a short "summary": one or two sentences, addressed directly to the candidate ("You..."),
giving a concise, honest, constructive reason for their overall performance on this specific task
— this will be shown/emailed to them directly, so keep it plain, specific, and free of jargon.`;
}
