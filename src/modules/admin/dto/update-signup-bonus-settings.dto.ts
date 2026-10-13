import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateSignupBonusSettingsDto {
  @IsBoolean({ message: 'enabled must be true or false' })
  enabled: boolean;

  @IsInt({ message: 'creditAmount must be a whole number' })
  @Min(0, { message: 'creditAmount cannot be negative' })
  creditAmount: number;
}
