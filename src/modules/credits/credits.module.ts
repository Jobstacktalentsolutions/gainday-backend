import { Module } from '@nestjs/common';
import { CreditLedgerService } from './credit-ledger.service';
import { CreditPurchasesService } from './credit-purchases.service';
import { SignupBonusSettingsService } from './signup-bonus-settings.service';

@Module({
  providers: [
    CreditLedgerService,
    CreditPurchasesService,
    SignupBonusSettingsService,
  ],
  exports: [
    CreditLedgerService,
    CreditPurchasesService,
    SignupBonusSettingsService,
  ],
})
export class CreditsModule {}
