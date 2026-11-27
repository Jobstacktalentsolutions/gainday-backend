import { SKILL_LEVEL, SkillLevel } from '../../common/skill-level';

/**
 * The line between what a task says and advice on doing it well. The generator writes to it and the
 * critic checks against it, so both read one definition and cannot drift.
 */
export const REQUIREMENT_VS_TIP_RULE = `Candidate-facing text should state the deliverable and any needed format, evidence, scope, or tone. Do not coach the candidate toward the answer by suggesting a strategy, preferred conclusion, or specific tactic, or by naming the factors, sources or points the answer should cover. Flag only clear answer-leading advice; when unsure, treat it as a requirement. Never state word counts or length rules — the platform UI handles those.`;

export const TASK_TEXT_LIMITS = {
  rankingLabelCharacters: 60,
} as const;
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
  [SKILL_LEVEL.ENTRY]: { questionWords: 80, rankingDescriptionCharacters: 90 },
  [SKILL_LEVEL.JUNIOR]: {
    questionWords: 100,
    rankingDescriptionCharacters: 100,
  },
  [SKILL_LEVEL.MID]: { questionWords: 120, rankingDescriptionCharacters: 120 },
  [SKILL_LEVEL.SENIOR]: {
    questionWords: 140,
    rankingDescriptionCharacters: 140,
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
  /** How the task is worded: vocabulary, jargon, how much of an artefact is shown, and the answer asked for. */
  language: string;
  planning: string;
  /** How a replacement candidate is focused: the scope it stays within. */
  replacementFocus: string;
}

const DIFFICULTY_PROFILES: Record<SkillLevel, DifficultyProfile> = {
  [SKILL_LEVEL.ENTRY]: {
    label: 'ENTRY LEVEL (recent graduate, no job experience)',
    asks: 'use everyday common sense on a short situation about what a customer or the business sees, such as an order, a message or a refund. The candidate is not placed in the technical role, and no rule, procedure or job knowledge is needed; the facts given are enough.',
    constraints:
      'One constraint in play. One answer is clearly best, and an average person would pick it without training. Put everything in a short situation of a few sentences, with no policy, rule or reference notes; the sensible, fair choice is the answer. Ask one question for one common-sense decision, never a trade-off between options.',
    stakeholders: 'at most one, friendly. No politics or pressure.',
    strongAnswer:
      'a clear, honest answer in everyday words that uses the information given.',
    data: 'three or four rows with plain labels and no ambiguous item.',
    language:
      'everyday words only: no tool, protocol or acronym names, no code, and no talk of systems, servers or engineers. Write about what a customer or the business sees and does, for example "a customer got the same message twice". If the brief names a technical idea, write about the everyday event it causes instead. Short sentences, one idea each. Show only the one fact the answer turns on. Ask for a short answer in the candidate\'s own words.',
    planning:
      "Every task is an everyday situation that a customer or the business sees in the job's field, never the technical work itself. Example for a backend role: 'A customer was charged twice for one order. What should the shop do first?' Choose task types an average person can answer by common sense: choose an action, classify, or sequence familiar steps. At most one short written reply. Each briefDescription names the one fact the answer turns on, not a tool or a rule.",
    replacementFocus:
      "Favour everyday situations from the job's field, with no tools or jargon.",
  },
  [SKILL_LEVEL.JUNIOR]: {
    label: 'JUNIOR / ENTRY LEVEL',
    asks: 'apply a stated rule, policy or procedure to clear evidence.',
    constraints:
      'Scope: one component, one failure, or one rule. The answer follows from a fact stated in the material, and one answer is clearly best. When options are offered, the stated rule rules out all but one. A justification restates the rule that applies; it does not weigh competing designs.',
    stakeholders:
      'at most one, cooperative. No executive trade-offs or politics.',
    strongAnswer: 'correct application of the rule and clear reasoning.',
    data: 'few lines or rows, and no ambiguous item.',
    language:
      'plain words first. Name a field term only after saying what it means, for example "a message that can arrive twice (a duplicate)". Common tools may be named with no setup detail. Short sentences. Describe what a log or record shows in words instead of pasting it, and refer to things by what they are, not by code names. Ask for a short explanation.',
    planning:
      'At most one task whose answer is open-ended writing. The others choose an action, classify, sequence, or interpret supplied data. Each briefDescription names the one rule or fact the task turns on.',
    replacementFocus:
      "Favour the job's subject matter, at the scope the level sets.",
  },
  [SKILL_LEVEL.MID]: {
    label: 'MID LEVEL',
    asks: 'diagnose a problem or prioritise competing work from the evidence.',
    constraints:
      'no more than 3 constraints in play, and one detail that does not matter. The candidate combines two sources of information.',
    stakeholders: 'up to two, with different interests.',
    strongAnswer: 'sound reasoning that names one trade-off.',
    data: 'a moderate number of lines or rows, including one that does not affect the answer.',
    language:
      'field terms without defining the common ones; define only specialised ones. Show a realistic artefact with one irrelevant detail. A sentence may carry two related ideas. Ask for reasoning with one trade-off.',
    planning:
      'Prefer task types that diagnose or prioritise. Each briefDescription names the competing priorities or the detail to ignore.',
    replacementFocus:
      "Favour the job's subject matter, at the scope the level sets.",
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
    language:
      'field terms assumed, with no definitions. Terse, consequence-led stakeholder language (cost, risk, timeline). Show full artefacts and let the candidate find what matters. Longer, denser sentences are fine. Ask for a recommendation and the trade-off it accepts.',
    planning:
      'Prefer judgment-heavy task types (pushback, justification, trade-off decisions). Each briefDescription names the tension or the missing information the candidate must handle.',
    replacementFocus: 'Favour role-specific expertise.',
  },
};

export function getSeniorityGuidance(skillLevel?: string | null): string {
  const profile = DIFFICULTY_PROFILES[resolveSkillLevel(skillLevel)];
  return [
    `Target seniority: ${profile.label}. Apply what fits the task type.`,
    `- The task asks the candidate to ${profile.asks}`,
    `- Constraints and information: ${profile.constraints}`,
    `- Stakeholders: ${profile.stakeholders}`,
    `- Language: ${profile.language}`,
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
export function getSeniorityReplacementFocus(
  skillLevel?: string | null,
): string {
  return DIFFICULTY_PROFILES[resolveSkillLevel(skillLevel)].replacementFocus;
}

export function getSeniorityDataGuidance(skillLevel?: string | null): string {
  return DIFFICULTY_PROFILES[resolveSkillLevel(skillLevel)].data;
}

/** One light line per level for the critic. It checks fit, not difficulty, so it stays lenient. */
const CRITIC_GUIDANCE: Record<SkillLevel, string> = {
  [SKILL_LEVEL.ENTRY]: 'Entry level: everyday tasks are fine.',
  [SKILL_LEVEL.JUNIOR]: 'Junior level: foundational tasks are fine.',
  [SKILL_LEVEL.MID]: 'Mid level: independent problem-solving is fine.',
  [SKILL_LEVEL.SENIOR]: 'Senior level: judgment-based tasks are fine.',
};

export function getSeniorityCriticGuidance(skillLevel?: string | null): string {
  return CRITIC_GUIDANCE[resolveSkillLevel(skillLevel)];
}
