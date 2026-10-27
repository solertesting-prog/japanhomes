import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  type Paginated,
  type PropertyCardDto,
  type PropertyDetailDto,
  type PropertyQuery,
  type SimulationDto,
  queryProperties,
  resolveModuleState,
  simulateInvestment,
  toPropertyDetail,
  toSimulationDto,
} from '@jpt/shared';
import { PropertiesRepository } from './properties.repository';

@Injectable()
export class PropertiesService {
  constructor(private readonly repo: PropertiesRepository) {}

  async list(query: PropertyQuery): Promise<Paginated<PropertyCardDto>> {
    const records = await this.repo.findPublished(query);
    return queryProperties(records, query);
  }

  async getBySlug(slug: string): Promise<PropertyDetailDto> {
    const record = await this.repo.findPublishedBySlug(slug);
    if (!record) throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: `No published property "${slug}"` });
    return toPropertyDetail(record);
  }

  async simulate(slug: string, amount: bigint): Promise<SimulationDto> {
    if (!resolveModuleState('INVESTMENT_SIMULATOR', process.env).enabled) {
      throw new UnprocessableEntityException({ code: 'MODULE_DISABLED', message: 'The investment simulator is disabled' });
    }
    const record = await this.repo.findPublishedBySlug(slug);
    if (!record) throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: `No published property "${slug}"` });
    const result = simulateInvestment({
      financials: record.financials,
      tokensSold: record.tokensSold,
      amount,
      minimumInvestment: record.minimumInvestment,
      maximumInvestment: record.maximumInvestment,
    });
    return toSimulationDto(result);
  }
}
