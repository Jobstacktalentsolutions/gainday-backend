/** The seniority levels a job can target. Task generation, the job parser and seeds all read this one list. */
export const SKILL_LEVEL = {
  ENTRY: 'Entry level',
  JUNIOR: 'Junior',
  MID: 'Mid level',
  SENIOR: 'Senior level',
} as const;

export type SkillLevel = (typeof SKILL_LEVEL)[keyof typeof SKILL_LEVEL];

/** The levels as a non-empty tuple, for schemas that need an enum. */
export const SKILL_LEVEL_VALUES = Object.values(SKILL_LEVEL) as [
  SkillLevel,
  ...SkillLevel[],
];
