import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeService } from './stripe.service';
import { AuthModule } from '../auth/auth.module';
import { CreditsModule } from '../credits/credits.module';
import { EmailModule } from '../email/email.module';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [AuthModule, CreditsModule, EmailModule, SubmissionsModule],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [PaymentsService, StripeService],
})
export class PaymentsModule {}
