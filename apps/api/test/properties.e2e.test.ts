import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DEMO_PROPERTIES, findDemoProperty, type PropertyQuery } from '@jpt/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { PropertiesController } from '../src/properties/properties.controller';
import { PropertiesRepository } from '../src/properties/properties.repository';
import { PropertiesService } from '../src/properties/properties.service';
import { StatsController } from '../src/stats/stats.controller';

/** In-memory repository backed by the DEMO fixtures (no database needed). */
const fakeRepo: Pick<PropertiesRepository, 'findPublished' | 'findPublishedBySlug' | 'countInvestors'> = {
  findPublished: async (_q?: PropertyQuery) => [...DEMO_PROPERTIES],
  findPublishedBySlug: async (slug: string) => findDemoProperty(slug) ?? null,
  countInvestors: async () => 0,
};

describe('Properties API (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PropertiesController, StatsController],
      providers: [
        PropertiesService,
        { provide: PropertiesRepository, useValue: fakeRepo },
        { provide: PrismaService, useValue: {} },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists with filters, sort and pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/properties')
      .query({ city: 'tokyo,osaka', sort: 'price_asc', pageSize: '2' })
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBeGreaterThan(2);
    expect(res.body.items.every((p: { city: string }) => ['tokyo', 'osaka'].includes(p.city))).toBe(true);
    expect(typeof res.body.items[0].purchasePrice).toBe('string');
  });

  it('rejects invalid filters with a structured 400', async () => {
    const res = await request(app.getHttpServer()).get('/v1/properties').query({ city: 'atlantis' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details[0].path).toBe('city.0');
  });

  it('returns a detail page payload', async () => {
    const res = await request(app.getHttpServer()).get('/v1/properties/tokyo-shibuya-apartment').expect(200);
    expect(res.body.tokenPrice).toBe('1000');
    expect(res.body.token.totalSupply).toBe('30000');
    expect(res.body.isDemo).toBe(true);
  });

  it('returns 404 for unknown properties', async () => {
    const res = await request(app.getHttpServer()).get('/v1/properties/does-not-exist').expect(404);
    expect(res.body.code).toBe('PROPERTY_NOT_FOUND');
  });

  it('simulates the brief example: ¥100,000 → 100 tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/properties/tokyo-shibuya-apartment/simulate')
      .send({ amount: '100000' })
      .expect(200);
    expect(res.body.isProjection).toBe(true);
    expect(res.body.tokens).toBe('100');
    expect(res.body.scenarios.map((s: { key: string }) => s.key)).toEqual(['optimistic', 'base', 'pessimistic']);
  });

  it('rejects fractional yen', async () => {
    await request(app.getHttpServer())
      .post('/v1/properties/tokyo-shibuya-apartment/simulate')
      .send({ amount: '100.50' })
      .expect(400);
  });

  it('computes stats from data and reports DEMO status', async () => {
    const res = await request(app.getHttpServer()).get('/v1/stats').expect(200);
    expect(res.body.isDemo).toBe(true);
    expect(res.body.propertiesPublished).toBe(DEMO_PROPERTIES.length);
    expect(res.body.registeredInvestors).toBe(0);
  });
});
