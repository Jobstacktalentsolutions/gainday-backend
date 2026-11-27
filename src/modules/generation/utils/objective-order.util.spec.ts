import { INTERACTION } from '../roles/role-module.interface';
import { shuffleObjectiveOrder } from './objective-order.util';

describe('shuffleObjectiveOrder', () => {
  it('reorders ranking items, keeping every item, and never returns the original order', () => {
    const items = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];
    for (let run = 0; run < 50; run++) {
      const result = shuffleObjectiveOrder(INTERACTION.PRIORITY_RANKING, {
        items,
      });
      const labels = (result!.items as { label: string }[]).map(
        (item) => item.label,
      );
      expect([...labels].sort()).toEqual(['A', 'B', 'C']);
      expect(labels).not.toEqual(['A', 'B', 'C']);
    }
  });

  it('keeps the sequencing answer key pointing at the same steps after shuffling', () => {
    const steps = ['first', 'second', 'third', 'fourth'];
    for (let run = 0; run < 50; run++) {
      const result = shuffleObjectiveOrder(INTERACTION.PROCEDURAL_SEQUENCING, {
        steps,
        correctOrder: [0, 1, 2, 3],
      });
      const shuffledSteps = result!.steps as string[];
      const ordered = (result!.correctOrder as number[]).map(
        (index) => shuffledSteps[index],
      );
      expect(ordered).toEqual(steps);
      expect(shuffledSteps).not.toEqual(steps);
    }
  });

  it('leaves other component types and empty components alone', () => {
    const single = { options: ['a', 'b'], correctOptionIndex: 0 };
    expect(shuffleObjectiveOrder(INTERACTION.SINGLE_BEST_ACTION, single)).toBe(
      single,
    );
    expect(
      shuffleObjectiveOrder(INTERACTION.PRIORITY_RANKING, null),
    ).toBeNull();
  });
});
