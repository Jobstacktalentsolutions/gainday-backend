import { InterfaceType } from './interface-type';
import { GeneratedTaskCandidate } from './role-module.interface';
import { unsourcedFigures } from './narrative-figures';

function task(text: string, payload: Record<string, unknown>): GeneratedTaskCandidate {
  return {
    taskType: 'T',
    taskContent: {
      taskType: 'T',
      title: 'Title',
      scenarioDescription: text,
      questionPrompt: 'Explain it.',
      businessProblemDerived: false,
      interfaceType: InterfaceType.TEXT_AREA,
      interfacePayload: payload,
    },
  };
}

describe('unsourcedFigures', () => {
  const table = { table: { rows: [['Cash', '$9,500.00']] } };

  it('accepts a figure the table shows, however it is formatted', () => {
    expect(unsourcedFigures(task('The balance is 9500 after the adjustment.', table))).toEqual([]);
  });

  it('flags a figure the table does not show', () => {
    expect(unsourcedFigures(task('The balance is about 8,000.', table))).toEqual(['8000']);
  });

  it('flags any digit when the payload carries no figures', () => {
    expect(unsourcedFigures(task('This happened in 2027.', { placeholder: null }))).toEqual(['2027']);
  });
});
