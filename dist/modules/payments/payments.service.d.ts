import { ConfigService } from '@nestjs/config';
export declare class PaymentsService {
    private readonly configService;
    private readonly pricePerCandidate;
    constructor(configService: ConfigService);
    calculateQuote(candidateCount: number): Promise<{
        unitPrice: number;
        totalAmount: number;
        currency: string;
        isFreeTierActive: boolean;
    }>;
    processUnlockCheckout(candidateIds: string[]): Promise<{
        success: boolean;
        transactionId?: string;
        amountPaid: number;
        unlockedCandidatesCount: number;
    }>;
}
