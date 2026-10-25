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

// Credits belong to employer profiles, so admins (who have none) are not allowed on the
// account-scoped routes below. Guards are applied per-route (not at the class level) so `packs`
// can stay public — the pricing page needs to list plans and prices before anyone has signed in.
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Public: the pricing page (and anywhere else) can list plans without being signed in. Buying
  // one still requires an account — see createPurchase.
  @Get('packs')
  getPacks() {
    return this.paymentsService.getPacks();
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  getBalance(@CurrentUser() user: AuthenticatedEmployer) {
    return this.paymentsService.getBalance(user.profileId);
  }

  @Post('unlock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  unlock(
    @Body() dto: UnlockCandidatesDto,
    @CurrentUser() user: AuthenticatedEmployer,
  ) {
    return this.paymentsService.unlock(user.profileId, dto.submissionIds);
  }

  /**
   * Starts an embedded Stripe Checkout for one credit pack — the general-purpose "pay for a
   * plan" entry point. Not tied to unlocking anything: this is exactly what the pricing page (or
   * any other "buy credits" surface, e.g. a future low-balance banner) should call directly with
   * just a packId. UnlockModal uses the same endpoint when it opens the pack picker on a 402.
   */
  @Post('purchases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  createPurchase(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: AuthenticatedEmployer,
  ) {
    return this.paymentsService.createPurchase(user.profileId, dto.packId);
  }

  @Get('purchases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  listPurchases(@CurrentUser() user: AuthenticatedEmployer) {
    return this.paymentsService.listPurchases(user.profileId);
  }

  @Get('unlocks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  listUnlocks(@CurrentUser() user: AuthenticatedEmployer) {
    return this.paymentsService.listUnlocks(user.profileId);
  }

  @Get('purchases/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  getPurchase(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedEmployer,
  ) {
    return this.paymentsService.getPurchase(user.profileId, id);
  }
}
