import { toPurchaseHistoryItem, toUnlockHistoryItem } from './payment-history.mapper';

describe('toPurchaseHistoryItem', () => {
  const purchase = {
    id: 'pur-1',
    packId: 'GROWTH',
    credits: 5,
    pricePence: 14900,
    createdAt: new Date('2026-10-20T09:00:00Z'),
    status: 'SUCCEEDED' as const,
  };

  it('names the pack from the catalogue and reports the snapshot figures', () => {
    expect(toPurchaseHistoryItem(purchase)).toEqual({
      id: 'pur-1',
      packName: 'Growth',
      creditsAdded: 5,
      pricePence: 14900,
      createdAt: '2026-10-20T09:00:00.000Z',
      status: 'SUCCEEDED',
    });
  });

  it('falls back to the pack id for a pack no longer in the catalogue', () => {
    expect(toPurchaseHistoryItem({ ...purchase, packId: 'RETIRED' }).packName).toBe('RETIRED');
  });
});

describe('toUnlockHistoryItem', () => {
  it('keeps the row when the candidate or job has been deleted', () => {
    expect(
      toUnlockHistoryItem({
        id: 'led-1',
        submissionId: null,
        jobId: null,
        jobTitle: null,
        candidateName: null,
        unlockedAt: new Date('2026-10-21T10:30:00Z'),
      }),
    ).toEqual({
      id: 'led-1',
      submissionId: null,
      jobId: null,
      jobTitle: null,
      candidateName: null,
      unlockedAt: '2026-10-21T10:30:00.000Z',
    });
  });
});
