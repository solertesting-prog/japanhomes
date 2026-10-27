import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { computePlatformStats, type PlatformStatsDto } from '@jpt/shared';
import { PropertiesRepository } from '../properties/properties.repository';

@ApiTags('stats')
@Public()
@Controller('stats')
export class StatsController {
  constructor(private readonly repo: PropertiesRepository) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOperation({ summary: 'Platform figures computed from the database (never hard-coded)' })
  async get(): Promise<PlatformStatsDto> {
    const [records, investors] = await Promise.all([this.repo.findPublished(), this.repo.countInvestors()]);
    return computePlatformStats(records, investors, new Date());
  }
}
