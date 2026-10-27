import { z } from 'zod';
import {
  CITIES,
  CITY_PREFECTURE,
  type City,
  type DocumentAccessLevel,
  type DocumentType,
  FUNDING_STATUSES,
  type FundingStatus,
  type LegalStructure,
  type Prefecture,
  PREFECTURES,
  type PropertyCondition,
  PROPERTY_TYPES,
  type PropertyType,
  RENTAL_STATUSES,
  type RentalStatus,
} from './domain';
import { computeOfferingMetrics, fundedBps, type OfferingFinancials } from './finance';
import { type Bps, toWire, type Yen } from './money';

/* -------------------------------------------------------------------------- */
/* Internal record (bigint money). Produced by the API from Prisma rows and by */
/* the DEMO data source from the seed fixtures.                                */
/* -------------------------------------------------------------------------- */

export interface PropertyRecord {
  id: string;
  slug: string;
  isDemo: boolean;
  name: string;
  city: City;
  prefecture: Prefecture;
  neighborhood: string;
  /** Ward / district level only. The exact address is never public. */
  approximateAddress: string;
  /** Rounded to ~1 km so the map pin does not reveal the building. */
  latitude: number;
  longitude: number;
  type: PropertyType;
  layout: string | null;
  structure: string;
  floorAreaM2: number;
  landAreaM2: number | null;
  yearBuilt: number;
  nearestStation: string;
  walkMinutes: number;
  condition: PropertyCondition;
  rentalStatus: RentalStatus;
  summary: string;
  description: string;
  highlights: string[];
  risks: Array<{ title: string; detail: string; level: 'LOW' | 'MEDIUM' | 'HIGH' }>;
  fundingStatus: FundingStatus;
  featured: boolean;
  publishedAt: Date;
  financials: OfferingFinancials;
  tokensSold: bigint;
  minimumInvestment: Yen;
  maximumInvestment: Yen | null;
  legalStructure: LegalStructure;
  token: {
    name: string;
    symbol: string;
    network: string;
    chainId: number | null;
    contractAddress: string | null;
    standard: string;
    economicRights: string;
    transferRestrictions: string;
  };
  roundOpensAt: Date | null;
  roundClosesAt: Date | null;
  valuation: {
    appraisedValue: Yen;
    appraisedAt: Date;
    method: string;
    appraiser: string;
  };
  documents: Array<{
    id: string;
    type: DocumentType;
    title: string;
    accessLevel: DocumentAccessLevel;
    sizeKb: number;
  }>;
  distributions: Array<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    paidAt: Date;
    totalAmount: Yen;
    amountPerToken: Yen;
  }>;
}

/* -------------------------------------------------------------------------- */
/* Wire DTOs (money as decimal strings, dates as ISO strings).                 */
/* -------------------------------------------------------------------------- */

export interface PropertyCardDto {
  id: string;
  slug: string;
  isDemo: boolean;
  name: string;
  city: City;
  prefecture: Prefecture;
  neighborhood: string;
  type: PropertyType;
  layout: string | null;
  floorAreaM2: number;
  yearBuilt: number;
  rentalStatus: RentalStatus;
  fundingStatus: FundingStatus;
  featured: boolean;
  purchasePrice: string;
  totalCapital: string;
  tokenPrice: string;
  minimumInvestment: string;
  grossYieldBps: Bps;
  investorYieldBps: Bps;
  fundedBps: Bps;
  totalTokens: string;
  tokensAvailable: string;
  occupancyBps: Bps;
  publishedAt: string;
}

export interface PropertyDetailDto extends PropertyCardDto {
  approximateAddress: string;
  latitude: number;
  longitude: number;
  structure: string;
  landAreaM2: number | null;
  nearestStation: string;
  walkMinutes: number;
  condition: PropertyCondition;
  summary: string;
  description: string;
  highlights: string[];
  risks: PropertyRecord['risks'];
  legalStructure: LegalStructure;
  maximumInvestment: string | null;
  financials: {
    purchasePrice: string;
    acquisitionCosts: string;
    renovationCosts: string;
    reserves: string;
    totalCapital: string;
    annualGrossRent: string;
    occupancyBps: Bps;
    effectiveGrossIncome: string;
    annualOperatingExpenses: string;
    annualPropertyTax: string;
    propertyManagementFeeBps: Bps;
    propertyManagementFee: string;
    platformFeeBps: Bps;
    platformFee: string;
    subscriptionFeeBps: Bps;
    netOperatingIncome: string;
    estimatedDistributable: string;
    totalAnnualCosts: string;
    grossYieldBps: Bps;
    netYieldBps: Bps;
    investorYieldBps: Bps;
  };
  token: PropertyRecord['token'] & { totalSupply: string; tokensSold: string; tokensAvailable: string };
  roundOpensAt: string | null;
  roundClosesAt: string | null;
  valuation: { appraisedValue: string; appraisedAt: string; method: string; appraiser: string };
  documents: PropertyRecord['documents'];
  distributions: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    paidAt: string;
    totalAmount: string;
    amountPerToken: string;
  }>;
}

export function toPropertyCard(p: PropertyRecord): PropertyCardDto {
  const m = computeOfferingMetrics(p.financials);
  return {
    id: p.id,
    slug: p.slug,
    isDemo: p.isDemo,
    name: p.name,
    city: p.city,
    prefecture: p.prefecture,
    neighborhood: p.neighborhood,
    type: p.type,
    layout: p.layout,
    floorAreaM2: p.floorAreaM2,
    yearBuilt: p.yearBuilt,
    rentalStatus: p.rentalStatus,
    fundingStatus: p.fundingStatus,
    featured: p.featured,
    purchasePrice: toWire(p.financials.purchasePrice),
    totalCapital: toWire(m.totalCapital),
    tokenPrice: toWire(m.tokenPrice),
    minimumInvestment: toWire(p.minimumInvestment),
    grossYieldBps: m.grossYieldBps,
    investorYieldBps: m.investorYieldBps,
    fundedBps: fundedBps(p.tokensSold, p.financials.totalTokens),
    totalTokens: toWire(p.financials.totalTokens),
    tokensAvailable: toWire(p.financials.totalTokens - p.tokensSold),
    occupancyBps: p.financials.occupancyBps,
    publishedAt: p.publishedAt.toISOString(),
  };
}

export function toPropertyDetail(p: PropertyRecord): PropertyDetailDto {
  const f = p.financials;
  const m = computeOfferingMetrics(f);
  return {
    ...toPropertyCard(p),
    approximateAddress: p.approximateAddress,
    latitude: p.latitude,
    longitude: p.longitude,
    structure: p.structure,
    landAreaM2: p.landAreaM2,
    nearestStation: p.nearestStation,
    walkMinutes: p.walkMinutes,
    condition: p.condition,
    summary: p.summary,
    description: p.description,
    highlights: p.highlights,
    risks: p.risks,
    legalStructure: p.legalStructure,
    maximumInvestment: p.maximumInvestment === null ? null : toWire(p.maximumInvestment),
    financials: {
      purchasePrice: toWire(f.purchasePrice),
      acquisitionCosts: toWire(f.acquisitionCosts),
      renovationCosts: toWire(f.renovationCosts),
      reserves: toWire(f.reserves),
      totalCapital: toWire(m.totalCapital),
      annualGrossRent: toWire(f.annualGrossRent),
      occupancyBps: f.occupancyBps,
      effectiveGrossIncome: toWire(m.effectiveGrossIncome),
      annualOperatingExpenses: toWire(f.annualOperatingExpenses),
      annualPropertyTax: toWire(f.annualPropertyTax),
      propertyManagementFeeBps: f.propertyManagementFeeBps,
      propertyManagementFee: toWire(m.propertyManagementFee),
      platformFeeBps: f.platformFeeBps,
      platformFee: toWire(m.platformFee),
      subscriptionFeeBps: f.subscriptionFeeBps,
      netOperatingIncome: toWire(m.netOperatingIncome),
      estimatedDistributable: toWire(m.estimatedDistributable),
      totalAnnualCosts: toWire(m.totalAnnualCosts),
      grossYieldBps: m.grossYieldBps,
      netYieldBps: m.netYieldBps,
      investorYieldBps: m.investorYieldBps,
    },
    token: {
      ...p.token,
      totalSupply: toWire(f.totalTokens),
      tokensSold: toWire(p.tokensSold),
      tokensAvailable: toWire(f.totalTokens - p.tokensSold),
    },
    roundOpensAt: p.roundOpensAt?.toISOString() ?? null,
    roundClosesAt: p.roundClosesAt?.toISOString() ?? null,
    valuation: {
      appraisedValue: toWire(p.valuation.appraisedValue),
      appraisedAt: p.valuation.appraisedAt.toISOString(),
      method: p.valuation.method,
      appraiser: p.valuation.appraiser,
    },
    documents: p.documents,
    distributions: p.distributions.map((d) => ({
      id: d.id,
      periodStart: d.periodStart.toISOString(),
      periodEnd: d.periodEnd.toISOString(),
      paidAt: d.paidAt.toISOString(),
      totalAmount: toWire(d.totalAmount),
      amountPerToken: toWire(d.amountPerToken),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Marketplace query                                                           */
/* -------------------------------------------------------------------------- */

export const PROPERTY_SORTS = [
  'featured',
  'yield_desc',
  'price_asc',
  'price_desc',
  'min_investment_asc',
  'funded_desc',
  'newest',
] as const;
export type PropertySort = (typeof PROPERTY_SORTS)[number];

const yenString = z
  .string()
  .regex(/^\d{1,15}$/, 'Whole yen, digits only')
  .transform((v) => BigInt(v));

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).max(values.length));

export const propertyQuerySchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    city: csv(CITIES).optional(),
    prefecture: csv(PREFECTURES).optional(),
    type: csv(PROPERTY_TYPES).optional(),
    funding: csv(FUNDING_STATUSES).optional(),
    rental: csv(RENTAL_STATUSES).optional(),
    priceMin: yenString.optional(),
    priceMax: yenString.optional(),
    minInvestmentMax: yenString.optional(),
    yieldMinBps: z.coerce.number().int().min(0).max(10_000).optional(),
    featured: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    sort: z.enum(PROPERTY_SORTS).default('featured'),
    page: z.coerce.number().int().min(1).max(1_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(9),
  })
  .refine((v) => v.priceMin === undefined || v.priceMax === undefined || v.priceMin <= v.priceMax, {
    message: 'priceMin must be less than or equal to priceMax',
    path: ['priceMin'],
  });

export type PropertyQueryInput = z.input<typeof propertyQuerySchema>;
export type PropertyQuery = z.output<typeof propertyQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Reference implementation of the marketplace query over an in-memory list.
 * The API implements the same semantics in SQL (see PropertiesRepository);
 * the shared test-suite pins the behaviour both must follow.
 */
export function queryProperties(records: readonly PropertyRecord[], query: PropertyQuery): Paginated<PropertyCardDto> {
  const q = query.q?.toLowerCase();
  const cards = records
    .filter((p) => {
      if (q) {
        const haystack = [p.name, p.city, p.neighborhood, p.approximateAddress, p.nearestStation, p.summary]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (query.city?.length && !query.city.includes(p.city)) return false;
      if (query.prefecture?.length && !query.prefecture.includes(p.prefecture)) return false;
      if (query.type?.length && !query.type.includes(p.type)) return false;
      if (query.funding?.length && !query.funding.includes(p.fundingStatus)) return false;
      if (query.rental?.length && !query.rental.includes(p.rentalStatus)) return false;
      if (query.priceMin !== undefined && p.financials.purchasePrice < query.priceMin) return false;
      if (query.priceMax !== undefined && p.financials.purchasePrice > query.priceMax) return false;
      if (query.minInvestmentMax !== undefined && p.minimumInvestment > query.minInvestmentMax) return false;
      if (query.featured !== undefined && p.featured !== query.featured) return false;
      return true;
    })
    .map((p) => ({ record: p, card: toPropertyCard(p) }))
    .filter(({ card }) => query.yieldMinBps === undefined || card.investorYieldBps >= query.yieldMinBps);

  const fundingOrder: Record<FundingStatus, number> = { OPEN: 0, COMING_SOON: 1, FUNDED: 2, CLOSED: 3 };
  const cmpBig = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

  cards.sort((a, b) => {
    switch (query.sort) {
      case 'yield_desc':
        return b.card.investorYieldBps - a.card.investorYieldBps;
      case 'price_asc':
        return cmpBig(a.record.financials.purchasePrice, b.record.financials.purchasePrice);
      case 'price_desc':
        return cmpBig(b.record.financials.purchasePrice, a.record.financials.purchasePrice);
      case 'min_investment_asc':
        return cmpBig(a.record.minimumInvestment, b.record.minimumInvestment);
      case 'funded_desc':
        return b.card.fundedBps - a.card.fundedBps;
      case 'newest':
        return b.record.publishedAt.getTime() - a.record.publishedAt.getTime();
      case 'featured':
      default:
        return (
          Number(b.record.featured) - Number(a.record.featured) ||
          fundingOrder[a.record.fundingStatus] - fundingOrder[b.record.fundingStatus] ||
          b.record.publishedAt.getTime() - a.record.publishedAt.getTime()
        );
    }
  });

  // Stable tie-breaker so pagination is deterministic.
  const total = cards.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const start = (query.page - 1) * query.pageSize;
  return {
    items: cards.slice(start, start + query.pageSize).map((c) => c.card),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
  };
}

export { CITY_PREFECTURE };

/* -------------------------------------------------------------------------- */
/* Platform statistics                                                         */
/* -------------------------------------------------------------------------- */

export interface PlatformStatsDto {
  /** Sum of latest appraised values of published properties. */
  totalAssetValue: string;
  propertiesAvailable: number;
  propertiesPublished: number;
  /** null when the data source has no user registry (DEMO mode). */
  registeredInvestors: number | null;
  /** Sum of tokens sold × token price across published offerings. */
  capitalFunded: string;
  /** True when every figure comes from DEMO fixtures. */
  isDemo: boolean;
  asOf: string;
}

export function computePlatformStats(
  records: readonly PropertyRecord[],
  registeredInvestors: number | null,
  asOf: Date,
): PlatformStatsDto {
  let totalAssetValue = 0n;
  let capitalFunded = 0n;
  let available = 0;
  for (const p of records) {
    totalAssetValue += p.valuation.appraisedValue;
    const { tokenPrice } = computeOfferingMetrics(p.financials);
    capitalFunded += p.tokensSold * tokenPrice;
    if (p.fundingStatus === 'OPEN') available += 1;
  }
  return {
    totalAssetValue: toWire(totalAssetValue),
    propertiesAvailable: available,
    propertiesPublished: records.length,
    registeredInvestors,
    capitalFunded: toWire(capitalFunded),
    isDemo: records.length > 0 && records.every((r) => r.isDemo),
    asOf: asOf.toISOString(),
  };
}
