import { randomUUID } from 'crypto';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { DRIZZLE } from '../../db/db.constants';
import type { DrizzleDb } from '../../db/client';
import { employerProfiles } from '../../db/schema';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { CreditPurchasesService } from '../credits/credit-purchases.service';
import { InsufficientCreditsError } from '../credits/insufficient-credits.error';
import {
  CREDIT_CURRENCY,
  CREDIT_PACKS,
  findPack,
  recommendPack,
} from '../credits/credit-packs';
import { EmailQueueService } from '../email/email-queue.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { resolveCandidateContact } from '../submissions/candidate-contact';
import { StripeService } from './stripe.service';

type SubmissionWithContact = Awaited<
  ReturnType<SubmissionsService['findManyWithContactByIds']>
>[number];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly creditLedger: CreditLedgerService,
    private readonly creditPurchases: CreditPurchasesService,
    private readonly stripeService: StripeService,
    private readonly submissionsService: SubmissionsService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  getPacks() {
    return CREDIT_PACKS;
  }

  async getBalance(employerId: string) {
    return { balance: await this.creditLedger.getBalance(employerId) };
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
      throw error;
    }

    await this.requestCvs(
      employerId,
      submissions.filter((submission) =>
        newlyUnlockedIds.includes(submission.id),
      ),
    );

    return {
      unlockedSubmissionIds: submissionIds,
      creditsUsed: newlyUnlockedIds.length,
      balance: await this.creditLedger.getBalance(employerId),
    };
  }

  /**
   * Starts a pack purchase: creates the Stripe payment intent and a PENDING purchase record, and
   * returns the client secret the frontend confirms with. No credits are granted here — only the
   * Stripe webhook does that, once the payment has actually succeeded.
   */
  async createPurchase(employerId: string, packId: string) {
    const pack = findPack(packId);
    if (!pack) {
      throw new NotFoundException(`Unknown credit pack ${packId}`);
    }

    // Generated up front so the payment intent can carry it; the purchase row is inserted
    // before the client secret is returned, so the webhook always finds it.
    const purchaseId = randomUUID();
    const intent = await this.stripeService.createPaymentIntent({
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
      stripePaymentIntentId: intent.id,
    });

    return { purchaseId, clientSecret: intent.clientSecret };
  }

  async getPurchase(employerId: string, purchaseId: string) {
    const purchase = await this.creditPurchases.findForEmployer(
      employerId,
      purchaseId,
    );
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    return purchase;
  }

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.creditLedger.grantPurchase(event.data.object.id);
        break;
      case 'payment_intent.payment_failed':
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

  /**
   * Emails each newly unlocked candidate asking them to send their CV to the employer. The
   * unlock is already committed, so a failed email is logged rather than undoing it.
   */
  private async requestCvs(
    employerId: string,
    unlocked: SubmissionWithContact[],
  ): Promise<void> {
    if (unlocked.length === 0) {
      return;
    }
    const employer = await this.db.query.employerProfiles.findFirst({
      where: eq(employerProfiles.id, employerId),
      with: { user: true },
    });
    if (!employer) {
      throw new NotFoundException('Employer profile not found');
    }

    const results = await Promise.allSettled(
      unlocked.flatMap((submission) => {
        const contact = resolveCandidateContact(submission);
        if (!contact) {
          this.logger.warn(
            `Submission ${submission.id} has no contact email, skipping CV request`,
          );
          return [];
        }
        return this.emailQueue.enqueueEmail({
          to: contact.email,
          subject: `Send your CV to ${employer.companyName ?? 'the employer'}`,
          template: 'cv-request',
          context: {
            candidateName: contact.fullName,
            jobTitle: submission.job.title,
            companyName: employer.companyName,
            employerEmail: employer.user.email,
          },
        });
      }),
    );
    results.forEach((result) => {
      if (result.status === 'rejected') {
        this.logger.error(`Failed to queue CV request email: ${result.reason}`);
      }
    });
  }
}
