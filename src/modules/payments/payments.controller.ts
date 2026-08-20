import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('quote')
  async getQuote(@Query('candidates') count: string) {
    const parsedCount = parseInt(count || '1', 10);
    return this.paymentsService.calculateQuote(parsedCount);
  }

  @Post('checkout')
  async checkout(@Body() body: { candidateIds: string[] }) {
    return this.paymentsService.processUnlockCheckout(body.candidateIds);
  }
}
