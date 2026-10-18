import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(configService: ConfigService) {
    const secretKey = configService.get<string>('stripe.secretKey', '');
    this.webhookSecret = configService.get<string>('stripe.webhookSecret', '');

    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured');
    }
    const mode = configService.get<string>('stripe.mode', 'test');
    this.logger.log(`Stripe service initialized in ${mode.toUpperCase()} mode`);
    this.stripe = new Stripe(secretKey);
  }

  /**
   * Creates an embedded Checkout Session: Stripe owns the whole payment UI (card entry,
   * validation, 3D Secure) and we just read the outcome off the `checkout.session.*` webhook
   * events, rather than building and confirming a PaymentIntent ourselves.
   */
  async createCheckoutSession(params: {
    productName: string;
    amountPence: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; clientSecret: string }> {
    const session = await this.stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      mode: 'payment',
      // Embedded Checkout defaults to `redirect_on_completion: 'always'` — without this, Stripe
      // navigates the whole page to a return_url the instant a card payment finishes, even
      // though it completed entirely inside the iframe (this was the original bug: the employer
      // got bounced to a route that doesn't exist). 'never' is what actually keeps them on this
      // page and lets `onComplete` (not a page navigation) drive the UI. `return_url` must be
      // omitted entirely here — Stripe's API rejects the request if both are set ("You cannot
      // pass a return_url when ui_mode: embedded_page and redirect_on_completion: never"),
      // confirmed by a live 400 from the API, not just docs.
      redirect_on_completion: 'never',
      metadata: params.metadata,
      payment_intent_data: { metadata: params.metadata },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: params.currency,
            unit_amount: params.amountPence,
            product_data: { name: params.productName },
          },
        },
      ],
    });
    if (!session.client_secret) {
      throw new Error(`Checkout session ${session.id} has no client secret`);
    }
    return { id: session.id, clientSecret: session.client_secret };
  }

  /**
   * Live status, straight from Stripe — used as a fallback when a purchase is still PENDING in
   * our own DB (the webhook is the primary/fast path, see PaymentsService.handleStripeEvent, but
   * it can be delayed or, in local dev without `stripe listen` running, never arrive at all).
   * This lets the polling endpoint (GET /payments/purchases/:id) self-heal instead of leaving the
   * employer stuck on "confirming" for a payment Stripe already settled.
   */
  async retrieveCheckoutSession(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  /** Throws if the signature doesn't match the raw body and the webhook secret. */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }
}
