/**
 * Investor eligibility rules (pure, versioned).
 *
 * The rule set encodes the platform's CURRENT legal posture, not a legal
 * opinion: while CROSS_BORDER_INVESTORS is disabled, non-residents of Japan
 * may only use simulated subscriptions on DEMO offerings. Every assessment
 * stores which rules ran and the rule-set version (InvestorEligibility).
 */

export const ELIGIBILITY_RULESET_VERSION = 'jpt-rules-2026.10-prototype';

/** FATF "call for action" jurisdictions plus comprehensive-sanctions targets. Review with counsel. */
export const BLOCKED_JURISDICTIONS: ReadonlySet<string> = new Set(['KP', 'IR', 'MM', 'CU', 'SY']);

export type EligibilityRule =
  | 'KYC_APPROVED'
  | 'KYC_NOT_EXPIRED'
  | 'NO_SANCTIONS_MATCH'
  | 'NOT_BLOCKED_JURISDICTION'
  | 'RESIDENCY_ALLOWED_FOR_REAL_OFFERINGS'
  | 'ENTITY_BENEFICIAL_OWNERS_VERIFIED';

export interface EligibilityInput {
  kycStatus: 'NOT_STARTED' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  kycExpiresAt: Date | null;
  sanctionsMatch: boolean;
  pepMatch: boolean;
  countryOfResidence: string | null;
  isEntity: boolean;
  beneficialOwnersVerified: boolean;
  crossBorderEnabled: boolean;
  now: Date;
}

export interface RuleResult {
  rule: EligibilityRule;
  passed: boolean;
  detail?: string;
}

export interface EligibilityAssessment {
  /** May subscribe to simulated (DEMO) offerings. */
  simulatedAllowed: boolean;
  /** May subscribe to real offerings (also requires REAL_SUBSCRIPTIONS module). */
  realAllowed: boolean;
  /** PEP matches are allowed but always need enhanced due diligence by a human. */
  requiresEnhancedDueDiligence: boolean;
  results: RuleResult[];
  rulesetVersion: string;
}

export function assessEligibility(i: EligibilityInput): EligibilityAssessment {
  const country = i.countryOfResidence?.toUpperCase() ?? null;
  const results: RuleResult[] = [
    { rule: 'KYC_APPROVED', passed: i.kycStatus === 'APPROVED' },
    { rule: 'KYC_NOT_EXPIRED', passed: !!i.kycExpiresAt && i.kycExpiresAt > i.now },
    { rule: 'NO_SANCTIONS_MATCH', passed: !i.sanctionsMatch },
    {
      rule: 'NOT_BLOCKED_JURISDICTION',
      passed: !!country && !BLOCKED_JURISDICTIONS.has(country),
      detail: country ?? 'unknown',
    },
    {
      rule: 'ENTITY_BENEFICIAL_OWNERS_VERIFIED',
      passed: !i.isEntity || i.beneficialOwnersVerified,
    },
    {
      rule: 'RESIDENCY_ALLOWED_FOR_REAL_OFFERINGS',
      passed: country === 'JP' || i.crossBorderEnabled,
      detail: country === 'JP' ? 'Japan resident' : i.crossBorderEnabled ? 'Cross-border enabled' : 'Simulation only',
    },
  ];
  const base = results.filter((r) => r.rule !== 'RESIDENCY_ALLOWED_FOR_REAL_OFFERINGS').every((r) => r.passed);
  const residency = results.find((r) => r.rule === 'RESIDENCY_ALLOWED_FOR_REAL_OFFERINGS')!.passed;
  return {
    simulatedAllowed: base,
    realAllowed: base && residency,
    requiresEnhancedDueDiligence: i.pepMatch,
    results,
    rulesetVersion: ELIGIBILITY_RULESET_VERSION,
  };
}
