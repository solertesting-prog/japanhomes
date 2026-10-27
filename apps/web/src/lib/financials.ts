import { type OfferingFinancials, type PropertyDetailDto } from '@jpt/shared';

/** Wire DTO → domain financials (bigint), for client-side calculations. */
export function financialsFromDto(p: PropertyDetailDto): OfferingFinancials {
  const f = p.financials;
  return {
    purchasePrice: BigInt(f.purchasePrice),
    acquisitionCosts: BigInt(f.acquisitionCosts),
    renovationCosts: BigInt(f.renovationCosts),
    reserves: BigInt(f.reserves),
    annualGrossRent: BigInt(f.annualGrossRent),
    occupancyBps: f.occupancyBps,
    annualOperatingExpenses: BigInt(f.annualOperatingExpenses),
    annualPropertyTax: BigInt(f.annualPropertyTax),
    propertyManagementFeeBps: f.propertyManagementFeeBps,
    platformFeeBps: f.platformFeeBps,
    subscriptionFeeBps: f.subscriptionFeeBps,
    totalTokens: BigInt(p.totalTokens),
  };
}
