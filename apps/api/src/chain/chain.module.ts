import { Module } from '@nestjs/common';
import { ChainGateway } from './chain-gateway';
import { ChainController } from './chain.controller';
import { SimulatedChainGateway } from './simulated-chain.gateway';
import { TokenizationService } from './tokenization.service';

@Module({
  controllers: [ChainController],
  providers: [SimulatedChainGateway, { provide: ChainGateway, useExisting: SimulatedChainGateway }, TokenizationService],
  exports: [SimulatedChainGateway, TokenizationService],
})
export class ChainModule {}
