import { CREDIT_PACKS, recommendPack } from './credit-packs';

describe('recommendPack', () => {
  it.each([
    [1, 'STARTER'],
    [2, 'GROWTH'],
    [5, 'GROWTH'],
    [6, 'SCALE'],
    [12, 'SCALE'],
  ])(
    'recommends the smallest pack covering a shortfall of %i',
    (shortfall, packId) => {
      expect(recommendPack(shortfall).id).toBe(packId);
    },
  );

  it('falls back to the largest pack when none covers the shortfall', () => {
    expect(recommendPack(13)).toBe(CREDIT_PACKS[CREDIT_PACKS.length - 1]);
  });
});
