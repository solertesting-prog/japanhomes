import { Module } from '@nestjs/common';
import { KycModule } from '../kyc/kyc.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DevController } from './dev.controller';

@Module({
  imports: [KycModule, SubscriptionsModule],
  controllers: [DevController],
})
export class DevModule {}
