import type { CreditPurchaseStatus } from '../../db/schema';
import { findPack } from '../credits/credit-packs';

/** One row of the employer's purchase history (GET /payments/purchases). */
export interface PurchaseHistoryItem {
  id: string;
  packName: string;
  creditsAdded: number;
  pricePence: number;
  createdAt: string;
  status: CreditPurchaseStatus;
}

/** One row of the employer's unlock history (GET /payments/unlocks). Null fields mean the related
 *  submission, job or candidate has since been deleted. */
export interface UnlockHistoryItem {
  id: string;
  submissionId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  candidateName: string | null;
  unlockedAt: string;
}

export function toPurchaseHistoryItem(purchase: {
  id: string;
  packId: string;
  credits: number;
  pricePence: number;
  createdAt: Date;
  status: CreditPurchaseStatus;
}): PurchaseHistoryItem {
  // The pack name isn't stored on the purchase, so it comes from the catalogue. A pack removed
  // from the catalogue falls back to its id rather than failing the whole history.
  const pack = findPack(purchase.packId);
  return {
    id: purchase.id,
    packName: pack ? pack.name : purchase.packId,
    creditsAdded: purchase.credits,
    pricePence: purchase.pricePence,
    createdAt: purchase.createdAt.toISOString(),
    status: purchase.status,
  };
}

export function toUnlockHistoryItem(row: {
  id: string;
  submissionId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  candidateName: string | null;
  unlockedAt: Date;
}): UnlockHistoryItem {
  return {
    id: row.id,
    submissionId: row.submissionId,
    jobId: row.jobId,
    jobTitle: row.jobTitle,
    candidateName: row.candidateName,
    unlockedAt: row.unlockedAt.toISOString(),
  };
}
