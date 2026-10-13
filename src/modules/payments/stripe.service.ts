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
    this.stripe = new Stripe(secretKey);
  }

  async createPaymentIntent(params: {
    amountPence: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; clientSecret: string }> {
    const intent = await this.stripe.paymentIntents.create({
      amount: params.amountPence,
      currency: params.currency,
      metadata: params.metadata,
      automatic_payment_methods: { enabled: true },
    });
    if (!intent.client_secret) {
      throw new Error(`Payment intent ${intent.id} has no client secret`);
    }
    return { id: intent.id, clientSecret: intent.client_secret };
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
