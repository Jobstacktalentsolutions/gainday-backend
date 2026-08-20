import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    getQuote(count: string): Promise<{
        unitPrice: number;
        totalAmount: number;
        currency: string;
        isFreeTierActive: boolean;
    }>;
    checkout(body: {
        candidateIds: string[];
    }): Promise<{
        success: boolean;
        transactionId?: string;
        amountPaid: number;
        unlockedCandidatesCount: number;
    }>;
}
