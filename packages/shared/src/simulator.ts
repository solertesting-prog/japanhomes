import {
  applyScenario,
  computeOfferingMetrics,
  DEFAULT_SCENARIOS,
  type OfferingFinancials,
  type ScenarioAssumptions,
} from './finance';
import { applyBps, type Bps, mulDiv, type Ppm, ratioToBps, ratioToPpm, type Yen } from './money';

export interface SimulationInput {
  financials: OfferingFinancials;
  tokensSold: bigint;
  /** Amount the investor would like to commit, before fees. */
  amount: Yen;
  minimumInvestment: Yen;
  /** Per-investor cap for this round, if any. */
  maximumInvestment?: Yen | null;
  scenarios?: readonly ScenarioAssumptions[];
}

export type SimulationIssue =
  | 'BELOW_MINIMUM'
  | 'ABOVE_MAXIMUM'
  | 'EXCEEDS_AVAILABLE'
  | 'LESS_THAN_ONE_TOKEN'
  | 'ROUNDED_TO_WHOLE_TOKENS'
  | 'NEGATIVE_CASH_FLOW_SCENARIO';

export interface ScenarioResult {
  key: ScenarioAssumptions['key'];
  occupancyBps: Bps;
  /** Estimated distributable cash for the whole vehicle in this scenario. */
  vehicleDistributable: Yen;
  /** Investor's estimated annual distribution (never below zero). */
  annualDistribution: Yen;
  /** Annual / 12, floored. An equivalent for reading, not a payment schedule. */
  monthlyEquivalent: Yen;
  /** annualDistribution / invested amount. */
  yieldOnInvestedBps: Bps;
}

export interface SimulationResult {
  /** Always true: every figure here is a projection, never an actual distribution. */
  isProjection: true;
  tokenPrice: Yen;
  tokens: bigint;
  investedAmount: Yen;
  /** Part of the requested amount that does not buy a whole token. */
  unusedAmount: Yen;
  subscriptionFee: Yen;
  totalPayable: Yen;
  ownershipPpm: Ppm;
  /** Investor share of the annual platform fee, in the base case. */
  annualPlatformFeeShare: Yen;
  tokensAvailable: bigint;
  scenarios: ScenarioResult[];
  issues: SimulationIssue[];
  /** False when a blocking issue prevents this amount from being subscribed. */
  eligibleAmount: boolean;
}

const BLOCKING: ReadonlySet<SimulationIssue> = new Set([
  'BELOW_MINIMUM',
  'ABOVE_MAXIMUM',
  'EXCEEDS_AVAILABLE',
  'LESS_THAN_ONE_TOKEN',
]);

export function simulateInvestment(input: SimulationInput): SimulationResult {
  const { financials, tokensSold, amount, minimumInvestment, maximumInvestment } = input;
  const base = computeOfferingMetrics(financials);
  const tokenPrice = base.tokenPrice;
  const tokensAvailable = financials.totalTokens - tokensSold;
  const issues: SimulationIssue[] = [];

  const requested = amount < 0n ? 0n : amount;
  let tokens = requested / tokenPrice;
  if (tokens === 0n) issues.push('LESS_THAN_ONE_TOKEN');
  if (requested % tokenPrice !== 0n && tokens > 0n) issues.push('ROUNDED_TO_WHOLE_TOKENS');
  if (requested < minimumInvestment) issues.push('BELOW_MINIMUM');
  if (maximumInvestment != null && requested > maximumInvestment) issues.push('ABOVE_MAXIMUM');
  if (tokens > tokensAvailable) {
    issues.push('EXCEEDS_AVAILABLE');
    tokens = tokensAvailable > 0n ? tokensAvailable : 0n;
  }

  const investedAmount = tokens * tokenPrice;
  const unusedAmount = requested - investedAmount;
  const subscriptionFee = applyBps(investedAmount, financials.subscriptionFeeBps, 'ceil');
  const ownershipPpm = ratioToPpm(tokens, financials.totalTokens, 'floor');

  const scenarios = (input.scenarios ?? DEFAULT_SCENARIOS).map((assumptions): ScenarioResult => {
    const scenarioFinancials = applyScenario(financials, assumptions);
    const m = computeOfferingMetrics(scenarioFinancials);
    const share = m.estimatedDistributable > 0n
      ? mulDiv(m.estimatedDistributable, tokens, financials.totalTokens, 'floor')
      : 0n;
    if (m.estimatedDistributable < 0n && !issues.includes('NEGATIVE_CASH_FLOW_SCENARIO')) {
      issues.push('NEGATIVE_CASH_FLOW_SCENARIO');
    }
    return {
      key: assumptions.key,
      occupancyBps: scenarioFinancials.occupancyBps,
      vehicleDistributable: m.estimatedDistributable,
      annualDistribution: share,
      monthlyEquivalent: share / 12n,
      yieldOnInvestedBps: investedAmount > 0n ? ratioToBps(share, investedAmount) : 0,
    };
  });

  return {
    isProjection: true,
    tokenPrice,
    tokens,
    investedAmount,
    unusedAmount,
    subscriptionFee,
    totalPayable: investedAmount + subscriptionFee,
    ownershipPpm,
    annualPlatformFeeShare: mulDiv(base.platformFee, tokens, financials.totalTokens, 'ceil'),
    tokensAvailable,
    scenarios,
    issues,
    eligibleAmount: !issues.some((i) => BLOCKING.has(i)),
  };
}
