import { Module } from '@nestjs/common';
import { CreditLedgerService } from './credit-ledger.service';
import { CreditPurchasesService } from './credit-purchases.service';

@Module({
  providers: [CreditLedgerService, CreditPurchasesService],
  exports: [CreditLedgerService, CreditPurchasesService],
})
export class CreditsModule {}
