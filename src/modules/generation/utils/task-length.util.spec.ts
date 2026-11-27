import { InterfaceType } from '../roles/interface-type';
import { INTERACTION } from '../roles/role-module.interface';
import { taskLengthProblems } from './task-length.util';
import { SKILL_LEVEL } from '../../../common/skill-level';
import { textLimitsForSeniority } from '../task-text-rules';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';

const task: QuestionBankTaskContent = {
  taskType: 'GENERIC_PRIORITIZE_ITEMS', title: 'Prioritise', scenarioDescription: 'Context',
  questionPrompt: 'Rank the items.', businessProblemDerived: false,
  interfaceType: InterfaceType.TEXT_AREA, interfacePayload: {},
  objectiveComponent: { items: [{ label: 'Incident', description: 'A customer cannot sign in.' }] },
};

describe('taskLengthProblems', () => {
  it('accepts concise candidate-facing material', () => {
    expect(taskLengthProblems(task, INTERACTION.PRIORITY_RANKING)).toEqual([]);
  });
  it('flags long questions and ranking descriptions without changing content', () => {
    const limits = textLimitsForSeniority();
    const longQuestion = Array(limits.questionWords + 1).fill('word').join(' ');
    const longDescription = 'x'.repeat(limits.rankingDescriptionCharacters + 1);
    const input = { ...task, questionPrompt: longQuestion, objectiveComponent: { items: [{ label: 'Incident', description: longDescription }] } };
    expect(taskLengthProblems(input, INTERACTION.PRIORITY_RANKING)).toHaveLength(2);
    expect(input.objectiveComponent.items[0].description).toBe(longDescription);
  });
  it('does not treat other component types as rankings', () => {
    expect(taskLengthProblems(task, INTERACTION.CLASSIFICATION)).toEqual([]);
  });
  it('applies the appropriate limit to each seniority', () => {
    const input = { ...task, questionPrompt: Array(110).fill('word').join(' ') };
    expect(taskLengthProblems(input, INTERACTION.PRIORITY_RANKING, SKILL_LEVEL.JUNIOR)).toHaveLength(1);
    expect(taskLengthProblems(input, INTERACTION.PRIORITY_RANKING, SKILL_LEVEL.SENIOR)).toEqual([]);
  });
});
