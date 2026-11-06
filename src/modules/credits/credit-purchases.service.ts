import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { creditPurchases, NewCreditPurchase } from '../../db/schema';

@Injectable()
export class CreditPurchasesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async create(purchase: NewCreditPurchase) {
    const [created] = await this.db
      .insert(creditPurchases)
      .values(purchase)
      .returning();
    return created;
  }

  /** Every settled purchase this employer has made (SUCCEEDED or FAILED), newest first.
   *  PENDING purchases are excluded from the history until settled or expired to avoid
   *  confusing users with unconfirmed checkout sessions. */
  listForEmployer(employerId: string) {
    return this.db
      .select()
      .from(creditPurchases)
      .where(
        and(
          eq(creditPurchases.employerId, employerId),
          ne(creditPurchases.status, 'PENDING'),
        ),
      )
      .orderBy(desc(creditPurchases.createdAt));
  }

  async findForEmployer(employerId: string, purchaseId: string) {
    const purchase = await this.db.query.creditPurchases.findFirst({
      where: and(
        eq(creditPurchases.id, purchaseId),
        eq(creditPurchases.employerId, employerId),
      ),
    });
    return purchase ?? null;
  }

  /** Only a still-pending purchase can fail/expire: a later success for the same session wins. */
  async markFailed(stripeCheckoutSessionId: string): Promise<void> {
    await this.db
      .update(creditPurchases)
      .set({ status: 'FAILED', updatedAt: new Date() })
      .where(
        and(
          eq(creditPurchases.stripeCheckoutSessionId, stripeCheckoutSessionId),
          eq(creditPurchases.status, 'PENDING'),
        ),
      );
  }
}
