import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  private readonly pricePerCandidate = 50.0; // £50 flat rate per candidate unlock

  constructor(private readonly configService: ConfigService) {}

  async calculateQuote(candidateCount: number): Promise<{
    unitPrice: number;
    totalAmount: number;
    currency: string;
    isFreeTierActive: boolean;
  }> {
    const isFreeTierActive = this.configService.get<string>('FREE_TIER_LAUNCH_ACTIVE') !== 'false';
    const totalAmount = isFreeTierActive ? 0.0 : this.pricePerCandidate * candidateCount;

    return {
      unitPrice: this.pricePerCandidate,
      totalAmount,
      currency: 'GBP',
      isFreeTierActive,
    };
  }

  async processUnlockCheckout(candidateIds: string[]): Promise<{
    success: boolean;
    transactionId?: string;
    amountPaid: number;
    unlockedCandidatesCount: number;
  }> {
    const quote = await this.calculateQuote(candidateIds.length);
    
    // In production, integrate Stripe/Adyen/etc. checkout flow.
    // Currently free tier launch is active, or we mock successful payment checkout.
    const transactionId = `txn_${Math.random().toString(36).substring(2, 11)}`;

    return {
      success: true,
      transactionId,
      amountPaid: quote.totalAmount,
      unlockedCandidatesCount: candidateIds.length,
    };
  }
}
