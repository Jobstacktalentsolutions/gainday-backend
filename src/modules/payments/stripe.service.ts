import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly returnUrl: string;

  constructor(configService: ConfigService) {
    const secretKey = configService.get<string>('stripe.secretKey', '');
    this.webhookSecret = configService.get<string>('stripe.webhookSecret', '');
    // Only used as a fallback for payment methods that redirect out of the embedded Checkout
    // iframe (e.g. a bank 3DS page) — card payments never navigate the employer away from it.
    this.returnUrl = `${configService.get<string>('frontendUrl')}/employer/payments/return`;

    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured');
    }
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
      return_url: this.returnUrl,
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

  /** Throws if the signature doesn't match the raw body and the webhook secret. */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }
}
