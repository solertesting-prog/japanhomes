import { Injectable } from '@nestjs/common';
import type { Prisma } from '@jpt/database';
import type { PropertyQuery, PropertyRecord } from '@jpt/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PROPERTY_INCLUDE, toPropertyRecord } from './property.mapper';

@Injectable()
export class PropertiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Narrows the catalogue in SQL using indexed columns. Derived metrics
   * (investor yield, funding %) and the final sort/pagination are applied by
   * the shared `queryProperties`, so API and DEMO mode share one tested
   * implementation of marketplace semantics.
   */
  async findPublished(query?: PropertyQuery): Promise<PropertyRecord[]> {
    const where: Prisma.PropertyWhereInput = { status: 'PUBLISHED', publishedAt: { not: null } };
    if (query?.city?.length) where.city = { in: query.city.map((c) => c.toUpperCase()) as Prisma.EnumCityFilter['in'] };
    if (query?.prefecture?.length) {
      where.prefecture = { in: query.prefecture.map((p) => p.toUpperCase()) as Prisma.EnumPrefectureFilter['in'] };
    }
    if (query?.type?.length) where.type = { in: query.type };
    if (query?.rental?.length) where.rentalStatus = { in: query.rental };
    if (query?.featured !== undefined) where.featured = query.featured;
    if (query?.funding?.length) where.offerings = { some: { status: { in: query.funding } } };
    if (query?.priceMin !== undefined || query?.priceMax !== undefined) {
      where.financials = {
        some: {
          isCurrent: true,
          purchasePrice: {
            ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
            ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
          },
        },
      };
    }
    if (query?.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      where.OR = [
        { name: contains },
        { neighborhood: contains },
        { approximateAddress: contains },
        { nearestStation: contains },
        { summary: contains },
      ];
    }

    const rows = await this.prisma.property.findMany({ where, include: PROPERTY_INCLUDE });
    return rows.map(toPropertyRecord).filter((r): r is PropertyRecord => r !== null);
  }

  async findPublishedBySlug(slug: string): Promise<PropertyRecord | null> {
    const row = await this.prisma.property.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: PROPERTY_INCLUDE,
    });
    return row ? toPropertyRecord(row) : null;
  }

  async countInvestors(): Promise<number> {
    return this.prisma.user.count({
      where: { status: 'ACTIVE', roles: { some: { role: { key: { in: ['INVESTOR', 'VERIFIED_INVESTOR'] } } } } },
    });
  }
}
