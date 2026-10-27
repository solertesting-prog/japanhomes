/**
 * Regulatory module gates.
 *
 * Every capability of the platform is classified in one of four tiers
 * (see docs/LEGAL_MODEL.md §6). Regulated capabilities stay OFF unless BOTH:
 *   1. an explicit environment flag turns them on, and
 *   2. a legal approval reference (opinion letter / licence number) is recorded.
 * A flag without an approval reference is refused at boot, so a stray
 * `true` in an .env file can never open a regulated flow.
 */

export type RegulatoryTier =
  /** Safe to run in a prototype with DEMO data. */
  | 'PROTOTYPE'
  /** Can be built, but legal sign-off is needed before real users touch it. */
  | 'LEGAL_REVIEW'
  /** Likely needs a FIEA / 不特法 / PSA registration held by us or a partner. */
  | 'LICENSE_REQUIRED'
  /** Must not run in any environment until authorised. Demo UI only. */
  | 'BLOCKED';

export const REGULATED_MODULES = {
  PROPERTY_CATALOGUE: { tier: 'PROTOTYPE', description: 'Publish DEMO property listings and analytics' },
  INVESTMENT_SIMULATOR: { tier: 'PROTOTYPE', description: 'Projection calculator, clearly labelled as estimates' },
  SIMULATED_SUBSCRIPTIONS: { tier: 'PROTOTYPE', description: 'End-to-end subscription flow against the mock payment provider' },
  KYC_ONBOARDING: { tier: 'LEGAL_REVIEW', description: 'Identity verification with a real KYC provider (APPI, Act on Prevention of Transfer of Criminal Proceeds)' },
  INVESTOR_MARKETING: { tier: 'LICENSE_REQUIRED', description: 'Soliciting real investors for a specific offering' },
  REAL_SUBSCRIPTIONS: { tier: 'LICENSE_REQUIRED', description: 'Accepting real money for an offering' },
  TOKEN_ISSUANCE_MAINNET: { tier: 'LICENSE_REQUIRED', description: 'Minting tokens that represent real economic rights' },
  RENT_DISTRIBUTIONS: { tier: 'LICENSE_REQUIRED', description: 'Paying real rental income to investors' },
  CROSS_BORDER_INVESTORS: { tier: 'LEGAL_REVIEW', description: 'Accepting investors resident outside Japan (home-country securities law)' },
  STABLECOIN_PAYMENTS: { tier: 'BLOCKED', description: 'Settlement in stablecoins (Payment Services Act — electronic payment instruments)' },
  SECONDARY_MARKET: { tier: 'BLOCKED', description: 'Investor-to-investor trading of tokens' },
} as const satisfies Record<string, { tier: RegulatoryTier; description: string }>;

export type RegulatedModule = keyof typeof REGULATED_MODULES;

export interface ModuleState {
  module: RegulatedModule;
  tier: RegulatoryTier;
  enabled: boolean;
  approvalReference: string | null;
  reason: string;
}

export class RegulatoryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegulatoryConfigError';
  }
}

type Env = Record<string, string | undefined>;

export function flagName(module: RegulatedModule): string {
  return `JPT_ENABLE_${module}`;
}

export function approvalName(module: RegulatedModule): string {
  return `JPT_APPROVAL_REF_${module}`;
}

function truthy(value: string | undefined): boolean {
  return value !== undefined && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function resolveModuleState(module: RegulatedModule, env: Env): ModuleState {
  const { tier } = REGULATED_MODULES[module];
  const requested = truthy(env[flagName(module)]);
  const approvalReference = env[approvalName(module)]?.trim() || null;

  if (tier === 'PROTOTYPE') {
    const disabled = env[flagName(module)] !== undefined && !requested;
    return {
      module,
      tier,
      enabled: !disabled,
      approvalReference,
      reason: disabled ? 'Disabled by configuration' : 'Prototype capability',
    };
  }

  if (!requested) {
    return { module, tier, enabled: false, approvalReference, reason: 'Regulated module: off by default' };
  }

  if (tier === 'BLOCKED') {
    throw new RegulatoryConfigError(
      `${module} is BLOCKED and cannot be enabled by configuration. Change its tier in code only after authorisation is obtained.`,
    );
  }

  if (!approvalReference) {
    throw new RegulatoryConfigError(
      `${flagName(module)} is set but ${approvalName(module)} is empty. Record the legal approval reference before enabling ${module}.`,
    );
  }

  return { module, tier, enabled: true, approvalReference, reason: 'Enabled with recorded approval' };
}

export function resolveAllModules(env: Env): Record<RegulatedModule, ModuleState> {
  const out = {} as Record<RegulatedModule, ModuleState>;
  for (const module of Object.keys(REGULATED_MODULES) as RegulatedModule[]) {
    out[module] = resolveModuleState(module, env);
  }
  return out;
}
