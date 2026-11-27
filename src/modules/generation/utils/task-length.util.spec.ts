import { InterfaceType } from '../roles/interface-type';
import { INTERACTION } from '../roles/role-module.interface';
import { taskLengthProblems } from './task-length.util';
import { SKILL_LEVEL } from '../../../common/skill-level';
import { textLimitsForSeniority } from '../task-text-rules';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';

const task: QuestionBankTaskContent = {
  taskType: 'GENERIC_PRIORITIZE_ITEMS',
  title: 'Prioritise',
  scenarioDescription: 'An Incident has been reported.',
  questionPrompt: 'Rank the items.',
  businessProblemDerived: false,
  interfaceType: InterfaceType.TEXT_AREA,
  interfacePayload: {},
  objectiveComponent: {
    items: [{ label: 'Incident', description: 'A customer cannot sign in.' }],
  },
};

describe('taskLengthProblems', () => {
  it('accepts concise candidate-facing material', () => {
    expect(taskLengthProblems(task, INTERACTION.PRIORITY_RANKING)).toEqual([]);
  });
  it('flags long questions and ranking descriptions without changing content', () => {
    const limits = textLimitsForSeniority();
    const longQuestion = Array(limits.questionWords + 1)
      .fill('word')
      .join(' ');
    const longDescription = 'x'.repeat(limits.rankingDescriptionCharacters + 1);
    const input = {
      ...task,
      questionPrompt: longQuestion,
      objectiveComponent: {
        items: [{ label: 'Incident', description: longDescription }],
      },
    };
    expect(
      taskLengthProblems(input, INTERACTION.PRIORITY_RANKING),
    ).toHaveLength(2);
    expect(input.objectiveComponent.items[0].description).toBe(longDescription);
  });
  it('names the field and the limit that is over', () => {
    const limits = textLimitsForSeniority();
    const input = {
      ...task,
      objectiveComponent: {
        items: [
          {
            label: 'Incident',
            description: 'x'.repeat(limits.rankingDescriptionCharacters + 7),
          },
        ],
      },
    };
    const [problem] = taskLengthProblems(input, INTERACTION.PRIORITY_RANKING);
    expect(problem).toContain('"Incident"');
    expect(problem).toContain(
      `the description is ${limits.rankingDescriptionCharacters + 7} characters (limit ${limits.rankingDescriptionCharacters})`,
    );
    expect(problem).not.toContain('the label is');
  });
  it('flags ranking items the scenario never names', () => {
    const slots = {
      ...task,
      objectiveComponent: {
        items: [
          {
            label: 'Rank 1: lead to call back first',
            description: 'Rank 1 lead',
          },
          { label: 'Rank 2: lead to call back', description: 'Rank 2 lead' },
        ],
      },
    };
    expect(taskLengthProblems(slots, INTERACTION.PRIORITY_RANKING)).toEqual([
      expect.stringContaining('must name the items, not their position'),
      expect.stringContaining(
        'Ranking items must be the items the scenario names',
      ),
    ]);
  });
  it('accepts ranking items whose names are in the scenario, even with a detail after the name', () => {
    const named = {
      ...task,
      scenarioDescription:
        'Alex Rivera and Sam Lee both asked for a call back.',
      objectiveComponent: {
        items: [
          { label: 'Alex Rivera - project manager', description: 'Large firm' },
          { label: 'Sam Lee', description: 'Small firm' },
        ],
      },
    };
    expect(taskLengthProblems(named, INTERACTION.PRIORITY_RANKING)).toEqual([]);
  });
  it('flags labels that state a position instead of naming the item', () => {
    const positional = {
      ...task,
      scenarioDescription: 'Maya and Sam asked for a call back.',
      objectiveComponent: {
        items: [
          { label: '2nd to call', description: 'Maya, owner of a bakery' },
          { label: '1st to call', description: 'Sam, owner of a florist' },
        ],
      },
    };
    expect(
      taskLengthProblems(positional, INTERACTION.PRIORITY_RANKING),
    ).toEqual([
      expect.stringContaining('must name the items, not their position'),
    ]);
  });
  it('accepts generic labels when the item is named in its description', () => {
    const generic = {
      ...task,
      scenarioDescription: 'Maya and Sam asked for a call back.',
      objectiveComponent: {
        items: [
          { label: 'Lead A', description: 'Maya, owner of a bakery' },
          { label: 'Lead B', description: 'Sam, owner of a florist' },
        ],
      },
    };
    expect(taskLengthProblems(generic, INTERACTION.PRIORITY_RANKING)).toEqual(
      [],
    );
  });
  it('does not treat other component types as rankings', () => {
    expect(taskLengthProblems(task, INTERACTION.CLASSIFICATION)).toEqual([]);
  });
  it('applies the appropriate limit to each seniority', () => {
    const input = {
      ...task,
      questionPrompt: Array(110).fill('word').join(' '),
    };
    expect(
      taskLengthProblems(
        input,
        INTERACTION.PRIORITY_RANKING,
        SKILL_LEVEL.JUNIOR,
      ),
    ).toHaveLength(1);
    expect(
      taskLengthProblems(
        input,
        INTERACTION.PRIORITY_RANKING,
        SKILL_LEVEL.SENIOR,
      ),
    ).toEqual([]);
  });
});
