/**
 * The line between what a task says and advice on doing it well. The generator writes to it and the
 * critic checks against it, so both read one definition and cannot drift.
 */
export const REQUIREMENT_VS_TIP_RULE = `A requirement states the work to deliver (actions, format, recipient, content). Never state word counts or length rules in candidate-facing text — the platform UI handles that automatically.
A tip advises how to succeed (strategy, order of work, recommended tone, tactics, or evaluation criteria).`;

export function getSeniorityGuidance(skillLevel?: string | null): string {
  switch (skillLevel) {
    case 'Junior':
      return [
        'Target Seniority: JUNIOR / ENTRY LEVEL.',
        '- Scope & Focus: Emphasize foundational domain literacy, standard operational procedures, and core domain metrics/tools.',
        '- Task Structure: Ground in concrete artifacts, explicit guidance, and structured workflows rather than open-ended strategic ambiguity.',
        '- Difficulty Calibration: Do not demand executive-level trade-offs or complex organizational politics. Candidate should demonstrate accurate procedural execution and sound fundamentals.',
      ].join('\n');

    case 'Senior level':
      return [
        'Target Seniority: SENIOR / LEAD LEVEL.',
        '- Scope & Focus: Assess the judgment expected of an experienced practitioner on one focused, realistic decision.',
        '- Task Structure: Include only the context and constraints needed for that decision; avoid turning it into a large strategic project.',
        '- Difficulty Calibration: Allow experienced candidates to demonstrate nuanced judgment within the allotted time.',
      ].join('\n');

    case 'Mid level':
    default:
      return [
        'Target Seniority: MID LEVEL.',
        '- Scope & Focus: Assess independent execution and practical judgment in a typical responsibility for the role.',
        '- Task Structure: Focus on one manageable scenario, including competing priorities only when relevant.',
        '- Difficulty Calibration: Requires solid domain competence and familiarity with industry standards.',
      ].join('\n');
  }
}

export function getSeniorityCriticGuidance(skillLevel?: string | null): string {
  switch (skillLevel) {
    case 'Junior':
      return [
        'Seniority Calibration (JUNIOR / ENTRY LEVEL):',
        '- Evaluate whether the task tests real foundational domain knowledge and execution relevant to this role (e.g. core workflows, key domain metrics, standard operating procedures).',
        '- DO NOT penalize or reject a junior task simply because its domain concepts are foundational, its procedures follow industry best-practice standards, or its scope avoids executive-level complexity.',
        '- Reject ONLY if the task has zero connection to the role\'s domain or requires no domain understanding at all.',
      ].join('\n');

    case 'Senior level':
      return [
        'Seniority Calibration (SENIOR / LEAD LEVEL):',
        '- Assess whether the task offers an experienced candidate a reasonable opportunity to demonstrate relevant judgment; a focused procedural task can be appropriate.',
      ].join('\n');

    case 'Mid level':
    default:
      return [
        'Seniority Calibration (MID LEVEL):',
        '- The task should require independent operational problem-solving and domain competence beyond basic common sense, without requiring executive-level authority.',
      ].join('\n');
  }
}
