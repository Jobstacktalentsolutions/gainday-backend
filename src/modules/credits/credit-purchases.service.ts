import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
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

  /** Every purchase this employer has started, newest first, whatever its status. */
  listForEmployer(employerId: string) {
    return this.db
      .select()
      .from(creditPurchases)
      .where(eq(creditPurchases.employerId, employerId))
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
