import { randomUUID } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { CreditPurchasesService } from '../credits/credit-purchases.service';
import { InsufficientCreditsError } from '../credits/insufficient-credits.error';
import { SubmissionWithdrawnError } from '../credits/submission-withdrawn.error';
import {
  CREDIT_CURRENCY,
  CREDIT_PACKS,
  findPack,
  recommendPack,
} from '../credits/credit-packs';
import { SubmissionsService } from '../submissions/submissions.service';
import {
  toPurchaseHistoryItem,
  toUnlockHistoryItem,
} from './payment-history.mapper';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly creditLedger: CreditLedgerService,
    private readonly creditPurchases: CreditPurchasesService,
    private readonly stripeService: StripeService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  getPacks() {
    return CREDIT_PACKS;
  }

  async listPurchases(employerId: string) {
    const rows = await this.creditPurchases.listForEmployer(employerId);
    return rows.map(toPurchaseHistoryItem);
  }

  async listUnlocks(employerId: string) {
    const rows = await this.creditLedger.listUnlocksForEmployer(employerId);
    return rows.map(toUnlockHistoryItem);
  }

  async getBalance(employerId: string) {
    const [balance, lastPurchaseAt] = await Promise.all([
      this.creditLedger.getBalance(employerId),
      this.creditLedger.getLastPurchaseAt(employerId),
    ]);
    return {
      balance,
      lastRechargedAt: lastPurchaseAt?.toISOString() ?? null,
    };
  }

  /**
   * Spends credits to unlock the given submissions, which must all belong to the employer's jobs.
   * Already-unlocked ones cost nothing. When the balance can't cover the rest, nothing is spent
   * and a 402 tells the client how short the employer is and which pack to offer.
   */
  async unlock(employerId: string, submissionIds: string[]) {
    const submissions = await this.loadOwnedSubmissions(
      employerId,
      submissionIds,
    );

    let newlyUnlockedIds: string[];
    try {
      newlyUnlockedIds = await this.creditLedger.unlockSubmissions(
        employerId,
        submissionIds,
      );
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        throw this.toPaymentRequired(error);
      }
      if (error instanceof SubmissionWithdrawnError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    return {
      unlockedSubmissionIds: submissionIds,
      creditsUsed: newlyUnlockedIds.length,
      balance: await this.creditLedger.getBalance(employerId),
    };
  }

  /**
   * Starts a pack purchase: creates an embedded Stripe Checkout Session and a PENDING purchase
   * record, and returns the client secret the frontend mounts Checkout with. No credits are
   * granted here — only the Stripe webhook does that, once the payment has actually succeeded.
   */
  async createPurchase(employerId: string, packId: string) {
    const pack = findPack(packId);
    if (!pack) {
      throw new NotFoundException(`Unknown credit pack ${packId}`);
    }

    // Generated up front so the session can carry it; the purchase row is inserted before the
    // client secret is returned, so the webhook always finds it.
    const purchaseId = randomUUID();
    const session = await this.stripeService.createCheckoutSession({
      productName: `Gainday ${pack.name} credit pack (${pack.credits} unlock${pack.credits === 1 ? '' : 's'})`,
      amountPence: pack.pricePence,
      currency: CREDIT_CURRENCY,
      metadata: { purchaseId, employerId, packId: pack.id },
    });

    await this.creditPurchases.create({
      id: purchaseId,
      employerId,
      packId: pack.id,
      credits: pack.credits,
      pricePence: pack.pricePence,
      currency: CREDIT_CURRENCY,
      stripeCheckoutSessionId: session.id,
    });

    return { purchaseId, clientSecret: session.clientSecret };
  }

  /**
   * The webhook (handleStripeEvent) is the primary, fast path for marking a purchase
   * SUCCEEDED/FAILED, but it can be delayed or — in local dev without `stripe listen` forwarding
   * events — never arrive at all. Rather than have the frontend's poll time out and strand the
   * employer on "confirming" for a payment Stripe already settled, a still-PENDING purchase is
   * reconciled against Stripe's own API on every read here: this is the actual source of truth,
   * not our cached `status` column. grantPurchase/markFailed are both idempotent, so this is safe
   * to run even if the webhook fires around the same time.
   */
  async getPurchase(employerId: string, purchaseId: string) {
    const purchase = await this.creditPurchases.findForEmployer(
      employerId,
      purchaseId,
    );
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    if (purchase.status !== 'PENDING') {
      return purchase;
    }

    const session = await this.stripeService.retrieveCheckoutSession(
      purchase.stripeCheckoutSessionId,
    );
    if (session.payment_status === 'paid') {
      await this.creditLedger.grantPurchase(session.id);
    } else if (session.status === 'expired') {
      await this.creditPurchases.markFailed(session.id);
    } else {
      return purchase;
    }

    return (
      (await this.creditPurchases.findForEmployer(employerId, purchaseId)) ??
      purchase
    );
  }

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      // `completed` fires as soon as checkout finishes, but for a payment method that settles
      // asynchronously (e.g. a bank redirect) payment_status is still 'unpaid' at that point —
      // the later async_payment_succeeded/failed event is the one that actually grants/fails it.
      case 'checkout.session.completed':
        if (event.data.object.payment_status === 'paid') {
          await this.creditLedger.grantPurchase(event.data.object.id);
        }
        break;
      case 'checkout.session.async_payment_succeeded':
        await this.creditLedger.grantPurchase(event.data.object.id);
        break;
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        await this.creditPurchases.markFailed(event.data.object.id);
        break;
      default:
        this.logger.debug(`Ignoring Stripe event ${event.type}`);
    }
  }

  private async loadOwnedSubmissions(
    employerId: string,
    submissionIds: string[],
  ) {
    const submissions =
      await this.submissionsService.findManyWithContactByIds(submissionIds);
    if (submissions.length !== new Set(submissionIds).size) {
      throw new NotFoundException('One or more submissions were not found');
    }
    if (
      submissions.some((submission) => submission.job.employerId !== employerId)
    ) {
      throw new ForbiddenException(
        'You may only unlock candidates for your own jobs',
      );
    }
    return submissions;
  }

  private toPaymentRequired(error: InsufficientCreditsError) {
    return new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message: error.message,
        balance: error.balance,
        needed: error.needed,
        shortfall: error.shortfall,
        recommendedPackId: recommendPack(error.shortfall).id,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
