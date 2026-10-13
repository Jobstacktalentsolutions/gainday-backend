export interface CreditPack {
  id: string;
  name: string;
  pricePence: number;
  credits: number;
  /** Marketing badge shown on the pack, if any. */
  label: string | null;
}

// Pack prices and sizes are fixed by the client's pricing spec (Gainday Candidate Unlock
// Pricing and Payment, Oct 2026) — a constant rather than a table because they only change by a
// code release. Ordered smallest to largest; recommendPack relies on that.
export const CREDIT_PACKS = [
  { id: 'STARTER', name: 'Starter', pricePence: 4900, credits: 1, label: null },
  {
    id: 'GROWTH',
    name: 'Growth',
    pricePence: 14900,
    credits: 5,
    label: 'Most popular',
  },
  { id: 'SCALE', name: 'Scale', pricePence: 29900, credits: 12, label: null },
] as const satisfies readonly CreditPack[];

export const CREDIT_PACK_IDS: string[] = CREDIT_PACKS.map((pack) => pack.id);

export const CREDIT_CURRENCY = 'gbp';

export function findPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === packId);
}

/**
 * The smallest pack that covers `shortfall` credits. When the shortfall is bigger than the
 * largest pack no single pack covers it, so the largest is returned and the employer buys again
 * for the remainder.
 */
export function recommendPack(shortfall: number): CreditPack {
  const covering = CREDIT_PACKS.find((pack) => pack.credits >= shortfall);
  return covering ?? CREDIT_PACKS[CREDIT_PACKS.length - 1];
}
