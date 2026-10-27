import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { StatsController } from './stats.controller';

@Module({
  imports: [PropertiesModule],
  controllers: [StatsController],
})
export class StatsModule {}
