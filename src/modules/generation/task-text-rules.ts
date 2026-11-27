/**
 * The line between what a task says and advice on doing it well. The generator writes to it and the
 * critic checks against it, so both read one definition and cannot drift.
 */
export const REQUIREMENT_VS_TIP_RULE = `Candidate-facing text should state the deliverable and any needed format, evidence, scope, or tone. Do not coach the candidate toward the answer by suggesting a strategy, preferred conclusion, or specific tactic, or by naming the factors, sources or points the answer should cover. Flag only clear answer-leading advice; when unsure, treat it as a requirement. Never state word counts or length rules — the platform UI handles those.`;

export const TASK_TEXT_LIMITS = {
  rankingLabelCharacters: 60,
} as const;
export const SKILL_LEVEL = {
  JUNIOR: 'Junior',
  MID: 'Mid level',
  SENIOR: 'Senior level',
} as const;
export type SkillLevel = (typeof SKILL_LEVEL)[keyof typeof SKILL_LEVEL];

/**
 * A job saved without a level is treated as mid level. Any other unrecognised value is a data
 * error and fails here, instead of being quietly generated at the wrong difficulty.
 */
export function resolveSkillLevel(skillLevel?: string | null): SkillLevel {
  if (skillLevel === undefined || skillLevel === null) return SKILL_LEVEL.MID;
  const level = Object.values(SKILL_LEVEL).find(
    (known) => known === skillLevel,
  );
  if (!level) {
    throw new Error(
      `Unknown skill level "${skillLevel}". Expected one of: ${Object.values(SKILL_LEVEL).join(', ')}.`,
    );
  }
  return level;
}

const TEXT_LIMITS: Record<
  SkillLevel,
  { questionWords: number; rankingDescriptionCharacters: number }
> = {
  [SKILL_LEVEL.JUNIOR]: {
    questionWords: 100,
    rankingDescriptionCharacters: 60,
  },
  [SKILL_LEVEL.MID]: { questionWords: 120, rankingDescriptionCharacters: 80 },
  [SKILL_LEVEL.SENIOR]: {
    questionWords: 140,
    rankingDescriptionCharacters: 100,
  },
};

export function textLimitsForSeniority(skillLevel?: string | null) {
  return TEXT_LIMITS[resolveSkillLevel(skillLevel)];
}

/**
 * What makes a task harder or easier at each level. The planner, the generator and the spec-task
 * data prompt all read this one table, so they cannot drift. Difficulty comes from what the
 * candidate must decide, not from more material, so every level keeps the same time and size budget.
 */
interface DifficultyProfile {
  label: string;
  asks: string;
  constraints: string;
  stakeholders: string;
  strongAnswer: string;
  data: string;
  planning: string;
}

const DIFFICULTY_PROFILES: Record<SkillLevel, DifficultyProfile> = {
  [SKILL_LEVEL.JUNIOR]: {
    label: 'JUNIOR / ENTRY LEVEL',
    asks: 'apply a stated rule, policy or procedure to clear evidence.',
    constraints:
      '1 to 2 constraints in play. The material holds everything needed and one answer is clearly best.',
    stakeholders:
      'at most one, cooperative. No executive trade-offs or politics.',
    strongAnswer: 'correct application of the rule and clear reasoning.',
    data: 'few lines or rows, and no ambiguous item.',
    planning:
      'Prefer task types that apply a stated rule or procedure (classify, sequence, choose an action). Each briefDescription names the one rule or fact the task turns on.',
  },
  [SKILL_LEVEL.MID]: {
    label: 'MID LEVEL',
    asks: 'diagnose a problem or prioritise competing work from the evidence.',
    constraints:
      'about 3 constraints in play and one detail that does not matter. The candidate combines two sources of information.',
    stakeholders: 'up to two, with different interests.',
    strongAnswer: 'sound reasoning that names one trade-off.',
    data: 'a moderate number of lines or rows, including one that does not affect the answer.',
    planning:
      'Prefer task types that diagnose or prioritise. Each briefDescription names the competing priorities or the detail to ignore.',
  },
  [SKILL_LEVEL.SENIOR]: {
    label: 'SENIOR / LEAD LEVEL',
    asks: 'make and defend a call between defensible options.',
    constraints:
      '4 or more constraints in play, some in tension. The material has a gap the candidate must notice and handle by stating an assumption.',
    stakeholders: 'several, with pushback or consequences for the call.',
    strongAnswer:
      'a recommendation, the trade-off it accepts, and how the remaining risk is handled.',
    data: 'enough lines or rows that one needs a stated assumption or judgement call.',
    planning:
      'Prefer judgment-heavy task types (pushback, justification, trade-off decisions). Each briefDescription names the tension or the missing information the candidate must handle.',
  },
};

export function getSeniorityGuidance(skillLevel?: string | null): string {
  const profile = DIFFICULTY_PROFILES[resolveSkillLevel(skillLevel)];
  return [
    `Target seniority: ${profile.label}. Apply what fits the task type.`,
    `- The task asks the candidate to ${profile.asks}`,
    `- Constraints and information: ${profile.constraints}`,
    `- Stakeholders: ${profile.stakeholders}`,
    `- A strong answer shows: ${profile.strongAnswer}`,
    'Difficulty comes from what the candidate must decide, never from more material; stay within the size limits.',
  ].join('\n');
}

/**
 * What the planner needs at this level: what a task asks of the candidate and which task types to lean
 * on. The rest of the profile shapes how a single task is written, so only the generator reads it.
 */
export function getSeniorityPlanningGuidance(
  skillLevel?: string | null,
): string {
  const profile = DIFFICULTY_PROFILES[resolveSkillLevel(skillLevel)];
  return [
    `Target seniority: ${profile.label}. A task at this level asks the candidate to ${profile.asks}`,
    profile.planning,
  ].join('\n');
}

/** How complex the supplied data should be for this level, for tasks whose figures the model supplies. */
export function getSeniorityDataGuidance(skillLevel?: string | null): string {
  return DIFFICULTY_PROFILES[resolveSkillLevel(skillLevel)].data;
}

export function getSeniorityCriticGuidance(skillLevel?: string | null): string {
  switch (skillLevel) {
    case SKILL_LEVEL.JUNIOR:
      return [
        'Seniority Calibration (JUNIOR / ENTRY LEVEL):',
        '- Evaluate whether the task tests real foundational domain knowledge and execution relevant to this role (e.g. core workflows, key domain metrics, standard operating procedures).',
        '- DO NOT penalize or reject a junior task simply because its domain concepts are foundational, its procedures follow industry best-practice standards, or its scope avoids executive-level complexity.',
        "- Reject ONLY if the task has zero connection to the role's domain or requires no domain understanding at all.",
      ].join('\n');

    case SKILL_LEVEL.SENIOR:
      return [
        'Seniority Calibration (SENIOR / LEAD LEVEL):',
        '- Assess whether the task offers an experienced candidate a reasonable opportunity to demonstrate relevant judgment; a focused procedural task can be appropriate.',
      ].join('\n');

    case SKILL_LEVEL.MID:
    default:
      return [
        'Seniority Calibration (MID LEVEL):',
        '- The task should require independent operational problem-solving and domain competence beyond basic common sense, without requiring executive-level authority.',
      ].join('\n');
  }
}
