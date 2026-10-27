import { z } from 'zod';
import type { SimulationResult } from './simulator';
import { toWire } from './money';

/** Request body for POST /properties/:slug/simulate */
export const simulationRequestSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,13}$/, 'Amount must be whole yen, digits only')
    .transform((v) => BigInt(v)),
});
export type SimulationRequest = z.input<typeof simulationRequestSchema>;

export interface SimulationDto {
  isProjection: true;
  tokenPrice: string;
  tokens: string;
  investedAmount: string;
  unusedAmount: string;
  subscriptionFee: string;
  totalPayable: string;
  ownershipPpm: string;
  annualPlatformFeeShare: string;
  tokensAvailable: string;
  eligibleAmount: boolean;
  issues: SimulationResult['issues'];
  scenarios: Array<{
    key: 'optimistic' | 'base' | 'pessimistic';
    occupancyBps: number;
    vehicleDistributable: string;
    annualDistribution: string;
    monthlyEquivalent: string;
    yieldOnInvestedBps: number;
  }>;
}

export function toSimulationDto(r: SimulationResult): SimulationDto {
  return {
    isProjection: true,
    tokenPrice: toWire(r.tokenPrice),
    tokens: toWire(r.tokens),
    investedAmount: toWire(r.investedAmount),
    unusedAmount: toWire(r.unusedAmount),
    subscriptionFee: toWire(r.subscriptionFee),
    totalPayable: toWire(r.totalPayable),
    ownershipPpm: toWire(r.ownershipPpm),
    annualPlatformFeeShare: toWire(r.annualPlatformFeeShare),
    tokensAvailable: toWire(r.tokensAvailable),
    eligibleAmount: r.eligibleAmount,
    issues: r.issues,
    scenarios: r.scenarios.map((s) => ({
      key: s.key,
      occupancyBps: s.occupancyBps,
      vehicleDistributable: toWire(s.vehicleDistributable),
      annualDistribution: toWire(s.annualDistribution),
      monthlyEquivalent: toWire(s.monthlyEquivalent),
      yieldOnInvestedBps: s.yieldOnInvestedBps,
    })),
  };
}

/** Uniform error envelope returned by the API. */
export interface ApiErrorDto {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}
