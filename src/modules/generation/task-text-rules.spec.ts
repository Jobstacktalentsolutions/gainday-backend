import {
  getSeniorityGuidance,
  getSeniorityPlanningGuidance,
  resolveSkillLevel,
} from './task-text-rules';
import { SKILL_LEVEL } from '../../common/skill-level';

describe('skill level', () => {
  it('treats a job with no level as mid level', () => {
    expect(resolveSkillLevel(undefined)).toBe(SKILL_LEVEL.MID);
    expect(resolveSkillLevel(null)).toBe(SKILL_LEVEL.MID);
  });

  it('rejects an unrecognised level instead of guessing', () => {
    expect(() => resolveSkillLevel('Entry-level')).toThrow('Unknown skill level');
  });

  it('gives each level its own generation and planning guidance', () => {
    const levels = Object.values(SKILL_LEVEL);
    expect(new Set(levels.map((level) => getSeniorityGuidance(level))).size).toBe(levels.length);
    expect(new Set(levels.map((level) => getSeniorityPlanningGuidance(level))).size).toBe(levels.length);
  });
});
