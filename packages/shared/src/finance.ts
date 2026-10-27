import {
  applyBps,
  BPS_DENOMINATOR,
  type Bps,
  MoneyError,
  mulDiv,
  ratioToBps,
  type Yen,
} from './money';

/**
 * Inputs that describe the economics of one offering.
 * All amounts are annual unless stated, in integer yen. Rates in basis points.
 */
export interface OfferingFinancials {
  purchasePrice: Yen;
  acquisitionCosts: Yen;
  renovationCosts: Yen;
  /** Cash kept in the vehicle for repairs, vacancies and capex. */
  reserves: Yen;
  /** Contracted / market rent at 100 % occupancy, per year. */
  annualGrossRent: Yen;
  /** Expected physical occupancy over the year. */
  occupancyBps: Bps;
  /** Building management, repairs, insurance, utilities borne by the owner. */
  annualOperatingExpenses: Yen;
  /** Fixed asset tax + city planning tax (固定資産税・都市計画税). */
  annualPropertyTax: Yen;
  /** Property manager fee on collected rent. */
  propertyManagementFeeBps: Bps;
  /** Platform / asset-management fee on total capital, per year. */
  platformFeeBps: Bps;
  /** One-off subscription fee charged on top of the invested amount. */
  subscriptionFeeBps: Bps;
  totalTokens: bigint;
}

export interface OfferingMetrics {
  /** purchase + acquisition + renovation + reserves. */
  totalCapital: Yen;
  tokenPrice: Yen;
  effectiveGrossIncome: Yen;
  propertyManagementFee: Yen;
  /** Net operating income: EGI − opex − property tax − PM fee. */
  netOperatingIncome: Yen;
  platformFee: Yen;
  /** NOI − platform fee. Estimate of what could be distributed before investor-level taxes. */
  estimatedDistributable: Yen;
  /** Annual gross rent / purchase price (表面利回り, market convention). */
  grossYieldBps: Bps;
  /** NOI / total capital. */
  netYieldBps: Bps;
  /** Estimated distributable / total capital. The figure investors care about. */
  investorYieldBps: Bps;
  /** Total annual costs (opex + tax + PM fee + platform fee). */
  totalAnnualCosts: Yen;
}

export function totalCapitalOf(f: Pick<OfferingFinancials, 'purchasePrice' | 'acquisitionCosts' | 'renovationCosts' | 'reserves'>): Yen {
  return f.purchasePrice + f.acquisitionCosts + f.renovationCosts + f.reserves;
}

export function validateFinancials(f: OfferingFinancials): void {
  const amounts: Array<[string, Yen]> = [
    ['purchasePrice', f.purchasePrice],
    ['acquisitionCosts', f.acquisitionCosts],
    ['renovationCosts', f.renovationCosts],
    ['reserves', f.reserves],
    ['annualGrossRent', f.annualGrossRent],
    ['annualOperatingExpenses', f.annualOperatingExpenses],
    ['annualPropertyTax', f.annualPropertyTax],
  ];
  for (const [name, value] of amounts) {
    if (value < 0n) throw new MoneyError(`${name} cannot be negative`);
  }
  if (f.purchasePrice <= 0n) throw new MoneyError('purchasePrice must be positive');
  for (const [name, value] of [
    ['occupancyBps', f.occupancyBps],
    ['propertyManagementFeeBps', f.propertyManagementFeeBps],
    ['platformFeeBps', f.platformFeeBps],
    ['subscriptionFeeBps', f.subscriptionFeeBps],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 10_000) {
      throw new MoneyError(`${name} must be an integer between 0 and 10000 bps`);
    }
  }
  if (f.totalTokens <= 0n) throw new MoneyError('totalTokens must be positive');
  const capital = totalCapitalOf(f);
  if (capital % f.totalTokens !== 0n) {
    throw new MoneyError(
      `Total capital ¥${capital} is not divisible by ${f.totalTokens} tokens; token price must be a whole yen amount`,
    );
  }
}

export function computeOfferingMetrics(f: OfferingFinancials): OfferingMetrics {
  validateFinancials(f);
  const totalCapital = totalCapitalOf(f);
  const tokenPrice = totalCapital / f.totalTokens;

  const effectiveGrossIncome = applyBps(f.annualGrossRent, f.occupancyBps, 'floor');
  const propertyManagementFee = applyBps(effectiveGrossIncome, f.propertyManagementFeeBps, 'ceil');
  const netOperatingIncome =
    effectiveGrossIncome - f.annualOperatingExpenses - f.annualPropertyTax - propertyManagementFee;
  const platformFee = applyBps(totalCapital, f.platformFeeBps, 'ceil');
  const estimatedDistributable = netOperatingIncome - platformFee;

  return {
    totalCapital,
    tokenPrice,
    effectiveGrossIncome,
    propertyManagementFee,
    netOperatingIncome,
    platformFee,
    estimatedDistributable,
    grossYieldBps: ratioToBps(f.annualGrossRent, f.purchasePrice),
    netYieldBps: ratioToBps(netOperatingIncome, totalCapital),
    investorYieldBps: ratioToBps(estimatedDistributable, totalCapital),
    totalAnnualCosts: f.annualOperatingExpenses + f.annualPropertyTax + propertyManagementFee + platformFee,
  };
}

/** Share of the round already subscribed, in bps. */
export function fundedBps(tokensSold: bigint, totalTokens: bigint): Bps {
  if (totalTokens <= 0n) return 0;
  return ratioToBps(tokensSold, totalTokens, 'floor');
}

/**
 * Stress parameters applied on top of the base case.
 * Positive deltas raise the value; occupancy is clamped to [0, 100 %].
 */
export interface ScenarioAssumptions {
  key: 'optimistic' | 'base' | 'pessimistic';
  occupancyDeltaBps: number;
  rentDeltaBps: number;
  expenseDeltaBps: number;
}

export const DEFAULT_SCENARIOS: readonly ScenarioAssumptions[] = [
  { key: 'optimistic', occupancyDeltaBps: 300, rentDeltaBps: 300, expenseDeltaBps: 0 },
  { key: 'base', occupancyDeltaBps: 0, rentDeltaBps: 0, expenseDeltaBps: 0 },
  { key: 'pessimistic', occupancyDeltaBps: -1_000, rentDeltaBps: -500, expenseDeltaBps: 1_000 },
];

function adjust(amount: Yen, deltaBps: number): Yen {
  return mulDiv(amount, BPS_DENOMINATOR + BigInt(deltaBps), BPS_DENOMINATOR, 'half-even');
}

export function applyScenario(f: OfferingFinancials, s: ScenarioAssumptions): OfferingFinancials {
  const occupancy = Math.min(10_000, Math.max(0, f.occupancyBps + s.occupancyDeltaBps));
  return {
    ...f,
    occupancyBps: occupancy,
    annualGrossRent: adjust(f.annualGrossRent, s.rentDeltaBps),
    annualOperatingExpenses: adjust(f.annualOperatingExpenses, s.expenseDeltaBps),
  };
}
