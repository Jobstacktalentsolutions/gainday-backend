import { IsIn } from 'class-validator';
import { CREDIT_PACK_IDS } from '../../credits/credit-packs';

export class CreatePurchaseDto {
  @IsIn(CREDIT_PACK_IDS)
  packId: string;
}
