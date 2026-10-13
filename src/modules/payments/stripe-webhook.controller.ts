import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

// Public by design: Stripe calls this, so it is authenticated by the signature check instead of
// a JWT. Kept apart from PaymentsController so that controller's auth guards don't apply.
@Controller('payments/webhook')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!request.rawBody || !signature) {
      throw new BadRequestException('Missing webhook payload or signature');
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(
        request.rawBody,
        signature,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.paymentsService.handleStripeEvent(event);
    return { received: true };
  }
}
