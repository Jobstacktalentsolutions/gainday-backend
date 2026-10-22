import { chunk } from './chunk.util';

describe('chunk', () => {
  it('splits items into batches of the given size, keeping the remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no batches for an empty list', () => {
    expect(chunk([], 2)).toEqual([]);
  });
});
