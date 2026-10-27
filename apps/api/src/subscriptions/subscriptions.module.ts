import { Module } from '@nestjs/common';
import { LedgerService } from '../payments/ledger.service';
import { MockPaymentProvider, PaymentProvider } from '../payments/payment-provider';
import { PortfolioController } from '../portfolio/portfolio.controller';
import { PaymentWebhookController, SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [SubscriptionsController, PaymentWebhookController, PortfolioController],
  providers: [SubscriptionsService, LedgerService, MockPaymentProvider, { provide: PaymentProvider, useExisting: MockPaymentProvider }],
  exports: [SubscriptionsService, MockPaymentProvider, PaymentProvider, LedgerService],
})
export class SubscriptionsModule {}
