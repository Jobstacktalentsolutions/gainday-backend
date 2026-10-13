import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../db/schema';
import { UnlockCandidatesDto } from './dto/unlock-candidates.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

// The JWT strategy's validated user; profileId is the employer profile id for EMPLOYER users.
interface AuthenticatedEmployer {
  profileId: string;
}

// Credits belong to employer profiles, so admins (who have none) are not allowed here.
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('packs')
  getPacks() {
    return this.paymentsService.getPacks();
  }

  @Get('balance')
  getBalance(@CurrentUser() user: AuthenticatedEmployer) {
    return this.paymentsService.getBalance(user.profileId);
  }

  @Post('unlock')
  unlock(
    @Body() dto: UnlockCandidatesDto,
    @CurrentUser() user: AuthenticatedEmployer,
  ) {
    return this.paymentsService.unlock(user.profileId, dto.submissionIds);
  }

  @Post('purchases')
  createPurchase(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: AuthenticatedEmployer,
  ) {
    return this.paymentsService.createPurchase(user.profileId, dto.packId);
  }

  @Get('purchases/:id')
  getPurchase(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedEmployer,
  ) {
    return this.paymentsService.getPurchase(user.profileId, id);
  }
}
