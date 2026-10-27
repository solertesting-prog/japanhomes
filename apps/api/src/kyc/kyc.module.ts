import { Module } from '@nestjs/common';
import { ComplianceController, KycController, KycWebhookController } from './kyc.controller';
import { KycProvider, MockKycProvider } from './kyc-provider';
import { KycService } from './kyc.service';

@Module({
  controllers: [KycController, ComplianceController, KycWebhookController],
  providers: [KycService, MockKycProvider, { provide: KycProvider, useExisting: MockKycProvider }],
  exports: [KycService, MockKycProvider],
})
export class KycModule {}
