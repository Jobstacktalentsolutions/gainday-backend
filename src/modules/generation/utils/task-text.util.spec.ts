import { TaskSpecError } from '../roles/role-module.interface';
import { requireTaskText } from './task-text.util';

describe('requireTaskText', () => {
  const scenario =
    'A customer was charged twice for one order and has asked the shop for help.';

  it('accepts a titled task with a real scenario', () => {
    expect(() => requireTaskText('Charged twice', scenario)).not.toThrow();
  });

  it('rejects a blank title', () => {
    expect(() => requireTaskText('  ', scenario)).toThrow(TaskSpecError);
  });

  it('rejects a scenario that is only punctuation or a few words', () => {
    expect(() => requireTaskText('Charged twice', '.')).toThrow(TaskSpecError);
    expect(() =>
      requireTaskText('Charged twice', 'Charged twice. Help.'),
    ).toThrow(TaskSpecError);
  });
});
