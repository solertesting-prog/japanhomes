import type { Prisma } from '@jpt/database';
import type { City, FundingStatus, Prefecture, PropertyRecord } from '@jpt/shared';

/** Everything the public catalogue needs, loaded in one query. */
export const PROPERTY_INCLUDE = {
  financials: { where: { isCurrent: true }, take: 1 },
  valuations: { orderBy: { appraisedAt: 'desc' }, take: 1 },
  risks: { orderBy: { sortOrder: 'asc' } },
  documents: {
    where: { publishedAt: { not: null }, accessLevel: { not: 'INTERNAL' } },
    orderBy: [{ type: 'asc' }, { version: 'desc' }],
  },
  offerings: {
    where: { status: { in: ['COMING_SOON', 'OPEN', 'FUNDED', 'CLOSED'] } },
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: {
      contract: true,
      distributions: { where: { status: 'PAID' }, orderBy: { periodEnd: 'desc' } },
    },
  },
} satisfies Prisma.PropertyInclude;

export type PropertyRow = Prisma.PropertyGetPayload<{ include: typeof PROPERTY_INCLUDE }>;

const PUBLIC_FUNDING: ReadonlySet<string> = new Set(['COMING_SOON', 'OPEN', 'FUNDED', 'CLOSED']);

/**
 * Maps a Prisma row to the shared domain record. Returns null when the row is
 * not publishable (no current financials, valuation or public offering), so a
 * half-configured property can never leak into the catalogue.
 */
export function toPropertyRecord(row: PropertyRow): PropertyRecord | null {
  const financial = row.financials[0];
  const valuation = row.valuations[0];
  const offering = row.offerings[0];
  if (!financial || !valuation || !offering || !row.publishedAt || !PUBLIC_FUNDING.has(offering.status)) return null;

  const contract = offering.contract;
  return {
    id: row.id,
    slug: row.slug,
    isDemo: row.isDemo,
    name: row.name,
    city: row.city.toLowerCase() as City,
    prefecture: row.prefecture.toLowerCase() as Prefecture,
    neighborhood: row.neighborhood,
    approximateAddress: row.approximateAddress,
    latitude: row.latitude.toNumber(),
    longitude: row.longitude.toNumber(),
    type: row.type,
    layout: row.layout,
    structure: row.structure,
    floorAreaM2: row.floorAreaM2.toNumber(),
    landAreaM2: row.landAreaM2 === null ? null : row.landAreaM2.toNumber(),
    yearBuilt: row.yearBuilt,
    nearestStation: row.nearestStation,
    walkMinutes: row.walkMinutes,
    condition: row.condition,
    rentalStatus: row.rentalStatus,
    summary: row.summary,
    description: row.description,
    highlights: row.highlights,
    risks: row.risks.map((r) => ({ title: r.title, detail: r.detail, level: r.level })),
    fundingStatus: offering.status as FundingStatus,
    featured: row.featured,
    publishedAt: row.publishedAt,
    financials: {
      purchasePrice: financial.purchasePrice,
      acquisitionCosts: financial.acquisitionCosts,
      renovationCosts: financial.renovationCosts,
      reserves: financial.reserves,
      annualGrossRent: financial.annualGrossRent,
      occupancyBps: financial.occupancyBps,
      annualOperatingExpenses: financial.annualOperatingExpenses,
      annualPropertyTax: financial.annualPropertyTax,
      propertyManagementFeeBps: financial.propertyManagementFeeBps,
      platformFeeBps: financial.platformFeeBps,
      subscriptionFeeBps: financial.subscriptionFeeBps,
      totalTokens: offering.totalTokens,
    },
    tokensSold: offering.tokensSold,
    minimumInvestment: offering.minimumInvestment,
    maximumInvestment: offering.maximumInvestment,
    legalStructure: offering.legalStructure,
    token: {
      name: offering.tokenName,
      symbol: offering.tokenSymbol,
      network: contract?.network ?? 'Not deployed',
      chainId: contract && contract.chainId > 0 ? contract.chainId : null,
      contractAddress: contract?.address ?? null,
      standard: contract ? `${contract.standard}${contract.status === 'PLANNED' ? ' (planned)' : ''}` : 'Not decided',
      economicRights: offering.economicRights,
      transferRestrictions: offering.transferRestrictions,
    },
    roundOpensAt: offering.opensAt,
    roundClosesAt: offering.closesAt,
    valuation: {
      appraisedValue: valuation.appraisedValue,
      appraisedAt: valuation.appraisedAt,
      method: valuation.method,
      appraiser: valuation.appraiser,
    },
    documents: row.documents.map((d) => ({
      id: d.id,
      type: d.type as PropertyRecord['documents'][number]['type'],
      title: d.title,
      accessLevel: d.accessLevel,
      sizeKb: Math.ceil(d.sizeBytes / 1024),
    })),
    distributions: offering.distributions.map((d) => ({
      id: d.id,
      periodStart: d.periodStart,
      periodEnd: d.periodEnd,
      paidAt: d.paidAt ?? d.periodEnd,
      totalAmount: d.distributableAmount,
      amountPerToken: d.distributableAmount / offering.totalTokens,
    })),
  };
}
