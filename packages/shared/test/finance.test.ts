import { describe, expect, it } from 'vitest';
import { applyScenario, computeOfferingMetrics, DEFAULT_SCENARIOS, fundedBps, type OfferingFinancials } from '../src/finance';
import { simulateInvestment } from '../src/simulator';

/** The worked example from the product brief: ¥30,000,000 → 30,000 tokens of ¥1,000. */
const brief: OfferingFinancials = {
  purchasePrice: 30_000_000n,
  acquisitionCosts: 0n,
  renovationCosts: 0n,
  reserves: 0n,
  annualGrossRent: 1_536_000n,
  occupancyBps: 9_600,
  annualOperatingExpenses: 216_000n,
  annualPropertyTax: 96_000n,
  propertyManagementFeeBps: 500,
  platformFeeBps: 50,
  subscriptionFeeBps: 100,
  totalTokens: 30_000n,
};

describe('computeOfferingMetrics', () => {
  it('reproduces the brief example', () => {
    const m = computeOfferingMetrics(brief);
    expect(m.totalCapital).toBe(30_000_000n);
    expect(m.tokenPrice).toBe(1_000n);
    expect(m.grossYieldBps).toBe(512);
    expect(m.effectiveGrossIncome).toBe(1_474_560n);
    expect(m.propertyManagementFee).toBe(73_728n);
    expect(m.netOperatingIncome).toBe(1_088_832n);
    expect(m.platformFee).toBe(150_000n);
    expect(m.estimatedDistributable).toBe(938_832n);
    expect(m.netYieldBps).toBe(363);
    expect(m.investorYieldBps).toBe(313);
  });

  it('refuses a token supply that does not divide capital into whole yen', () => {
    expect(() => computeOfferingMetrics({ ...brief, totalTokens: 29_999n })).toThrow(/whole yen/);
  });

  it('refuses rates outside 0–100 %', () => {
    expect(() => computeOfferingMetrics({ ...brief, occupancyBps: 10_001 })).toThrow();
    expect(() => computeOfferingMetrics({ ...brief, platformFeeBps: -1 })).toThrow();
  });

  it('computes funding progress', () => {
    expect(fundedBps(21_450n, 30_000n)).toBe(7_150);
    expect(fundedBps(0n, 30_000n)).toBe(0);
  });
});

describe('scenarios', () => {
  it('clamps occupancy at 100 %', () => {
    const optimistic = DEFAULT_SCENARIOS.find((s) => s.key === 'optimistic')!;
    expect(applyScenario({ ...brief, occupancyBps: 9_900 }, optimistic).occupancyBps).toBe(10_000);
  });

  it('orders outcomes pessimistic ≤ base ≤ optimistic', () => {
    const results = DEFAULT_SCENARIOS.map((s) => computeOfferingMetrics(applyScenario(brief, s)).estimatedDistributable);
    const [opt, base, pes] = results as [bigint, bigint, bigint];
    expect(pes <= base).toBe(true);
    expect(base <= opt).toBe(true);
  });
});

describe('simulateInvestment', () => {
  const run = (amount: bigint, extra: Partial<Parameters<typeof simulateInvestment>[0]> = {}) =>
    simulateInvestment({
      financials: brief,
      tokensSold: 21_450n,
      amount,
      minimumInvestment: 50_000n,
      maximumInvestment: 3_000_000n,
      ...extra,
    });

  it('buys 100 tokens for ¥100,000 as in the brief', () => {
    const r = run(100_000n);
    expect(r.isProjection).toBe(true);
    expect(r.tokens).toBe(100n);
    expect(r.investedAmount).toBe(100_000n);
    expect(r.unusedAmount).toBe(0n);
    expect(r.subscriptionFee).toBe(1_000n);
    expect(r.totalPayable).toBe(101_000n);
    expect(r.ownershipPpm).toBe(3_333n);
    expect(r.eligibleAmount).toBe(true);
    const base = r.scenarios.find((s) => s.key === 'base')!;
    // 938,832 × 100 / 30,000 = 3,129.44 → floored
    expect(base.annualDistribution).toBe(3_129n);
    expect(base.monthlyEquivalent).toBe(260n);
    expect(base.yieldOnInvestedBps).toBe(313);
  });

  it('rounds down to whole tokens and reports the remainder', () => {
    const r = run(100_500n);
    expect(r.tokens).toBe(100n);
    expect(r.unusedAmount).toBe(500n);
    expect(r.issues).toContain('ROUNDED_TO_WHOLE_TOKENS');
    expect(r.eligibleAmount).toBe(true);
  });

  it('blocks amounts below the minimum or above the cap', () => {
    expect(run(10_000n).issues).toContain('BELOW_MINIMUM');
    expect(run(10_000n).eligibleAmount).toBe(false);
    expect(run(5_000_000n).issues).toContain('ABOVE_MAXIMUM');
  });

  it('never allocates more tokens than remain', () => {
    const r = run(3_000_000n, { tokensSold: 29_900n });
    expect(r.tokens).toBe(100n);
    expect(r.issues).toContain('EXCEEDS_AVAILABLE');
    expect(r.eligibleAmount).toBe(false);
  });

  it('floors negative-cash-flow scenarios at zero and flags them', () => {
    const r = simulateInvestment({
      financials: { ...brief, annualOperatingExpenses: 1_400_000n },
      tokensSold: 0n,
      amount: 100_000n,
      minimumInvestment: 1_000n,
    });
    const pessimistic = r.scenarios.find((s) => s.key === 'pessimistic')!;
    expect(pessimistic.annualDistribution).toBe(0n);
    expect(r.issues).toContain('NEGATIVE_CASH_FLOW_SCENARIO');
  });
});
