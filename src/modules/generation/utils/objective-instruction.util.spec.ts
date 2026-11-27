import { INTERACTION } from '../roles/role-module.interface';
import {
  objectiveInstruction,
  withObjectiveInstruction,
  questionRepeatsItems,
  withoutObjectiveInstruction,
} from './objective-instruction.util';

describe('objective instruction', () => {
  const type = INTERACTION.PROCEDURAL_SEQUENCING;
  const written = 'Then explain why the first step comes first.';

  it('puts the control instruction before the model-written question', () => {
    expect(withObjectiveInstruction(type, written)).toBe(
      `${objectiveInstruction(type)} ${written}`,
    );
  });

  it('adds the instruction once when a revised question already has it', () => {
    const once = withObjectiveInstruction(type, written);
    expect(withObjectiveInstruction(type, once)).toBe(once);
  });

  it('gives the model back only the part it wrote', () => {
    const full = withObjectiveInstruction(type, written);
    expect(withoutObjectiveInstruction(type, full)).toBe(written);
  });

  it('leaves the question alone for a task with no answer control or one a spec writes', () => {
    expect(withObjectiveInstruction(undefined, written)).toBe(written);
    expect(withObjectiveInstruction('NUMERIC_INPUT', written)).toBe(written);
  });

  it('uses the instruction alone when the model wrote no further question', () => {
    expect(withObjectiveInstruction(type, ' ')).toBe(
      objectiveInstruction(type),
    );
  });

  describe('questionRepeatsItems', () => {
    const component = {
      steps: [
        'Look up the order in the records',
        'Reply to the customer today',
      ],
    };

    it('flags a question that lists the control items word for word', () => {
      expect(
        questionRepeatsItems(
          'Order these: Look up the order in the records; Reply to the customer today.',
          component,
        ),
      ).toHaveLength(1);
    });

    it('accepts a question that only describes the written part', () => {
      expect(
        questionRepeatsItems('Then explain your reasoning.', component),
      ).toEqual([]);
    });

    it('does not flag a question that repeats a single item or a task with no control', () => {
      expect(
        questionRepeatsItems(
          'Look up the order in the records first.',
          component,
        ),
      ).toEqual([]);
      expect(questionRepeatsItems('Anything.', null)).toEqual([]);
    });
  });
});
