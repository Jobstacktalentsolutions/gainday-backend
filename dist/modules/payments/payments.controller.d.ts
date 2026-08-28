import { PaymentsService } from './payments.service';
import { SubmissionsService } from '../submissions/submissions.service';
export declare class PaymentsController {
    private readonly paymentsService;
    private readonly submissionsService;
    constructor(paymentsService: PaymentsService, submissionsService: SubmissionsService);
    getQuote(count: string): Promise<{
        unitPrice: number;
        totalAmount: number;
        currency: string;
        isFreeTierActive: boolean;
    }>;
    checkout(body: {
        candidateIds: string[];
    }, user: any): Promise<{
        success: boolean;
        transactionId?: string;
        amountPaid: number;
        unlockedCandidatesCount: number;
    }>;
}
