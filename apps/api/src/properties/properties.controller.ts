import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type PropertyQuery,
  propertyQuerySchema,
  PROPERTY_SORTS,
  type SimulationRequest,
  simulationRequestSchema,
} from '@jpt/shared';
import { z } from 'zod';
import { Public } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PropertiesService } from './properties.service';

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120);

@ApiTags('properties')
@Public()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'Search the published catalogue', description: 'Money fields are integer JPY encoded as strings; rates are basis points.' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'city', required: false, description: 'Comma-separated: tokyo,osaka,…' })
  @ApiQuery({ name: 'prefecture', required: false })
  @ApiQuery({ name: 'type', required: false, description: 'APARTMENT,HOUSE,RESIDENTIAL_BUILDING,COMMERCIAL,VACATION_HOME,AKIYA' })
  @ApiQuery({ name: 'funding', required: false, description: 'COMING_SOON,OPEN,FUNDED,CLOSED' })
  @ApiQuery({ name: 'rental', required: false })
  @ApiQuery({ name: 'priceMin', required: false })
  @ApiQuery({ name: 'priceMax', required: false })
  @ApiQuery({ name: 'minInvestmentMax', required: false })
  @ApiQuery({ name: 'yieldMinBps', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: PROPERTY_SORTS })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ description: 'Paginated property cards' })
  list(@Query(new ZodValidationPipe(propertyQuerySchema)) query: PropertyQuery) {
    return this.service.list(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Property detail with financials, token terms, documents and distributions' })
  @ApiParam({ name: 'slug', example: 'tokyo-shibuya-apartment' })
  get(@Param('slug', new ZodValidationPipe(slugSchema)) slug: string) {
    return this.service.getBySlug(slug);
  }

  @Post(':slug/simulate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Project an investment (estimates only, never a quote or an offer)',
    description: 'Returns whole tokens, fees, ownership share and optimistic/base/pessimistic projections.',
  })
  @ApiParam({ name: 'slug', example: 'tokyo-shibuya-apartment' })
  @ApiBody({ schema: { type: 'object', properties: { amount: { type: 'string', example: '100000' } }, required: ['amount'] } })
  simulate(
    @Param('slug', new ZodValidationPipe(slugSchema)) slug: string,
    @Body(new ZodValidationPipe(simulationRequestSchema)) body: z.output<typeof simulationRequestSchema>,
  ) {
    return this.service.simulate(slug, body.amount);
  }
}

export type { SimulationRequest };
