import { writtenResponseLimit, candidateReadingWords, slotBudgetMinutes, readingBudget, hasReferenceMaterial } from './task-budget.util';
import { taskLengthProblems } from './task-length.util';
import { QuestionBankTaskContent } from '../../../db/schema/question-bank.schema';
import { InterfaceType } from '../roles/interface-type';

const words = (count: number) => Array(count).fill('word').join(' ');

const task = (overrides: Partial<QuestionBankTaskContent> = {}): QuestionBankTaskContent => ({
  taskType: 'WRITTEN_JUSTIFICATION',
  title: 'Task',
  expectedDurationMinutes: 7,
  scenarioDescription: words(200),
  questionPrompt: words(100),
  openEndedComponent: { prompt: 'x' },
  businessProblemDerived: false,
  interfaceType: InterfaceType.TEXT_AREA,
  interfacePayload: { interfaceType: InterfaceType.TEXT_AREA, placeholder: null, wordLimit: { min: 60, max: 140 } },
  ...overrides,
});

const withLimit = (wordLimit: unknown) =>
  task({ interfacePayload: { interfaceType: InterfaceType.TEXT_AREA, placeholder: null, wordLimit } });

describe('task budget', () => {
  it('splits the simulation time evenly and rounds down', () => {
    expect(slotBudgetMinutes(4)).toBe(7);
  });

  it('shrinks the written limit as reading grows', () => {
    expect(writtenResponseLimit(7, 400).max).toBeLessThan(writtenResponseLimit(7, 200).max);
  });

  it('keeps a floor when reading uses the whole budget', () => {
    expect(writtenResponseLimit(7, 2000)).toEqual({ min: 20, max: 40 });
  });

  it('counts table and tab text but not the placeholder, chart or word limit', () => {
    expect(
      candidateReadingWords(
        task({
          scenarioDescription: words(10),
          questionPrompt: words(10),
          interfacePayload: {
            placeholder: words(50),
            wordLimit: { min: 1, max: 2 },
            chart: { categories: [words(30)] },
            caseFile: { tabs: [{ label: 'Tab', content: words(20) }] },
          },
        }),
      ),
    ).toBe(41);
  });
});

describe('time budget problems', () => {
  it('accepts a duration and word limit that fit the budget', () => {
    expect(taskLengthProblems(task(), undefined, undefined, 7)).toEqual([]);
  });

  it('flags a duration above the budget', () => {
    const problems = taskLengthProblems(task({ expectedDurationMinutes: 12 }), undefined, undefined, 7);
    expect(problems.join(' ')).toContain('12 minutes');
  });

  it('flags a word limit the candidate cannot write in the time left', () => {
    const problems = taskLengthProblems(withLimit({ min: 700, max: 1200 }), undefined, undefined, 7);
    expect(problems.join(' ')).toContain('1200');
  });

  it('flags a written answer with no word limit', () => {
    expect(taskLengthProblems(withLimit(null), undefined, undefined, 7).join(' ')).toContain('needs a wordLimit');
  });

  it('does not ask for a word limit when there is no written answer', () => {
    expect(taskLengthProblems(task({ openEndedComponent: undefined, interfacePayload: { wordLimit: null } }), undefined, undefined, 7)).toEqual([]);
  });

  it('tolerates a small reading overshoot but says which section to cut when it is large', () => {
    const slightly = task({ scenarioDescription: words(300), questionPrompt: words(100) });
    expect(taskLengthProblems(slightly, undefined, undefined, 7).join(' ')).not.toContain('must read');
    const heavy = task({ scenarioDescription: words(420), questionPrompt: words(110) });
    const message = taskLengthProblems(heavy, undefined, undefined, 7).join(' ');
    expect(message).toContain('scenario 420 (limit 210)');
    expect(message).toContain('question 110');
  });

  it('reserves a reference allowance only for tasks that show reference material', () => {
    expect(readingBudget(7, 120, true)).toEqual({ total: 420, scenario: 120, question: 120, reference: 180 });
    expect(readingBudget(7, 120, false)).toEqual({ total: 420, scenario: 210, question: 120, reference: 0 });
    expect(hasReferenceMaterial([InterfaceType.TEXT_AREA])).toBe(false);
    expect(hasReferenceMaterial([InterfaceType.TEXT_AREA, InterfaceType.CASE_FILE_TEXT_AREA])).toBe(true);
  });
});
