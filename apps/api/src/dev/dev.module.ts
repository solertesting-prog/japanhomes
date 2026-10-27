import { Module } from '@nestjs/common';
import { ChainModule } from '../chain/chain.module';
import { KycModule } from '../kyc/kyc.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DevController } from './dev.controller';

@Module({
  imports: [KycModule, SubscriptionsModule, ChainModule],
  controllers: [DevController],
})
export class DevModule {}
