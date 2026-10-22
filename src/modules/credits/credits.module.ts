import { Module } from '@nestjs/common';
import { CreditAdminService } from './credit-admin.service';
import { CreditLedgerService } from './credit-ledger.service';
import { CreditPurchasesService } from './credit-purchases.service';
import { SignupBonusSettingsService } from './signup-bonus-settings.service';

@Module({
  providers: [
    CreditLedgerService,
    CreditPurchasesService,
    SignupBonusSettingsService,
    CreditAdminService,
  ],
  exports: [
    CreditLedgerService,
    CreditPurchasesService,
    SignupBonusSettingsService,
    CreditAdminService,
  ],
})
export class CreditsModule {}
