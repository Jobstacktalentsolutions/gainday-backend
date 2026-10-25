import { factTable } from './case-file';

describe('factTable', () => {
  it('renders label/value rows under the given headers', () => {
    expect(factTable([['Name', 'Priya']], ['Field', 'Value'])).toBe(
      '| Field | Value |\n|---|---|\n| Name | Priya |',
    );
  });

  it('escapes pipes in labels and values so they do not split the cell', () => {
    expect(factTable([['Plan | tier', 'Gold | Plus']])).toContain('| Plan \\| tier | Gold \\| Plus |');
  });
});
