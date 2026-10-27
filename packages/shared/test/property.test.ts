import { describe, expect, it } from 'vitest';
import { DEMO_PROPERTIES } from '../src/demo/demo-properties';
import { computeOfferingMetrics } from '../src/finance';
import { computePlatformStats, propertyQuerySchema, queryProperties, toPropertyDetail } from '../src/property';

const q = (input: Record<string, unknown> = {}) => propertyQuerySchema.parse(input);

describe('DEMO fixtures', () => {
  it('has at least 12 properties across the six required cities', () => {
    expect(DEMO_PROPERTIES.length >= 12).toBe(true);
    const cities = new Set(DEMO_PROPERTIES.map((p) => p.city));
    for (const c of ['tokyo', 'osaka', 'kyoto', 'fukuoka', 'sapporo', 'nagoya']) expect(cities.has(c as never)).toBe(true);
  });

  it('marks every record as DEMO and every document title as [DEMO]', () => {
    for (const p of DEMO_PROPERTIES) {
      expect(p.isDemo).toBe(true);
      for (const d of p.documents) expect(d.title.startsWith('[DEMO]')).toBe(true);
    }
  });

  it('has unique slugs and valid economics', () => {
    expect(new Set(DEMO_PROPERTIES.map((p) => p.slug)).size).toBe(DEMO_PROPERTIES.length);
    for (const p of DEMO_PROPERTIES) {
      const m = computeOfferingMetrics(p.financials);
      expect(m.tokenPrice * p.financials.totalTokens).toBe(m.totalCapital);
      expect(p.tokensSold <= p.financials.totalTokens).toBe(true);
      expect(p.minimumInvestment % m.tokenPrice).toBe(0n);
    }
  });

  it('reports distributions as exact per-token amounts', () => {
    for (const p of DEMO_PROPERTIES) {
      for (const d of p.distributions) expect(d.totalAmount).toBe(d.amountPerToken * p.financials.totalTokens);
    }
  });

  it('includes the brief example', () => {
    const shibuya = DEMO_PROPERTIES.find((p) => p.slug === 'tokyo-shibuya-apartment')!;
    expect(shibuya.financials.totalTokens).toBe(30_000n);
    expect(toPropertyDetail(shibuya).tokenPrice).toBe('1000');
  });
});

describe('queryProperties', () => {
  it('paginates with stable totals', () => {
    const r = queryProperties(DEMO_PROPERTIES, q({ pageSize: '5', page: '3' }));
    expect(r.total).toBe(DEMO_PROPERTIES.length);
    expect(r.totalPages).toBe(Math.ceil(DEMO_PROPERTIES.length / 5));
    expect(r.items.length).toBe(DEMO_PROPERTIES.length - 10);
  });

  it('combines filters', () => {
    const r = queryProperties(DEMO_PROPERTIES, q({ city: 'tokyo,kyoto', funding: 'OPEN', pageSize: '48' }));
    expect(r.items.every((p) => ['tokyo', 'kyoto'].includes(p.city) && p.fundingStatus === 'OPEN')).toBe(true);
    expect(r.total > 0).toBe(true);
  });

  it('filters by investor yield and minimum investment', () => {
    const r = queryProperties(DEMO_PROPERTIES, q({ yieldMinBps: '350', minInvestmentMax: '50000', pageSize: '48' }));
    expect(r.items.every((p) => p.investorYieldBps >= 350 && BigInt(p.minimumInvestment) <= 50_000n)).toBe(true);
  });

  it('returns an empty page for cities without listings', () => {
    const r = queryProperties(DEMO_PROPERTIES, q({ city: 'kobe' }));
    expect(r.total).toBe(0);
    expect(r.items).toEqual([]);
  });

  it('sorts by price ascending', () => {
    const r = queryProperties(DEMO_PROPERTIES, q({ sort: 'price_asc', pageSize: '48' }));
    const prices = r.items.map((p) => BigInt(p.purchasePrice));
    for (let i = 1; i < prices.length; i++) expect(prices[i - 1]! <= prices[i]!).toBe(true);
  });

  it('searches names, neighbourhoods and stations', () => {
    expect(queryProperties(DEMO_PROPERTIES, q({ q: 'machiya' })).items[0]?.slug).toBe('kyoto-higashiyama-machiya');
    expect(queryProperties(DEMO_PROPERTIES, q({ q: 'Tenjin' })).total >= 1).toBe(true);
  });

  it('rejects invalid query input', () => {
    expect(() => q({ city: 'atlantis' })).toThrow();
    expect(() => q({ priceMin: '-5' })).toThrow();
    expect(() => q({ priceMin: '900', priceMax: '100' })).toThrow();
  });
});

describe('platform stats', () => {
  it('derives every figure from the records and never invents investors', () => {
    const s = computePlatformStats(DEMO_PROPERTIES, null, new Date('2026-10-27T00:00:00Z'));
    expect(s.isDemo).toBe(true);
    expect(s.registeredInvestors).toBe(null);
    expect(s.propertiesPublished).toBe(DEMO_PROPERTIES.length);
    expect(s.propertiesAvailable).toBe(DEMO_PROPERTIES.filter((p) => p.fundingStatus === 'OPEN').length);
  });
});
