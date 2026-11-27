import { countWords } from './word-count.util';

describe('countWords', () => {
  it('counts plain words', () => {
    expect(countWords('one two  three')).toBe(3);
    expect(countWords('   ')).toBe(0);
    expect(countWords('')).toBe(0);
  });

  it('does not count markdown table separators or bullets as words', () => {
    expect(countWords('| Item | Amount |\n|---|---|\n| Rent | 500 |')).toBe(4);
    expect(countWords('- one\n- two')).toBe(2);
  });
});
