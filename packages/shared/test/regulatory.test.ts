import { describe, expect, it } from 'vitest';
import { resolveAllModules, resolveModuleState } from '../src/regulatory';

describe('regulatory gates', () => {
  it('keeps every regulated module off with an empty environment', () => {
    const states = resolveAllModules({});
    expect(states.PROPERTY_CATALOGUE.enabled).toBe(true);
    expect(states.SIMULATED_SUBSCRIPTIONS.enabled).toBe(true);
    expect(states.REAL_SUBSCRIPTIONS.enabled).toBe(false);
    expect(states.TOKEN_ISSUANCE_MAINNET.enabled).toBe(false);
    expect(states.SECONDARY_MARKET.enabled).toBe(false);
    expect(states.STABLECOIN_PAYMENTS.enabled).toBe(false);
  });

  it('refuses to enable a licensed module without an approval reference', () => {
    expect(() => resolveModuleState('REAL_SUBSCRIPTIONS', { JPT_ENABLE_REAL_SUBSCRIPTIONS: 'true' })).toThrow(
      /JPT_APPROVAL_REF_REAL_SUBSCRIPTIONS/,
    );
  });

  it('enables a licensed module only with flag and approval reference', () => {
    const s = resolveModuleState('REAL_SUBSCRIPTIONS', {
      JPT_ENABLE_REAL_SUBSCRIPTIONS: 'true',
      JPT_APPROVAL_REF_REAL_SUBSCRIPTIONS: 'Counsel opinion 2027-001',
    });
    expect(s.enabled).toBe(true);
    expect(s.approvalReference).toBe('Counsel opinion 2027-001');
  });

  it('cannot enable a BLOCKED module through configuration at all', () => {
    expect(() =>
      resolveModuleState('SECONDARY_MARKET', {
        JPT_ENABLE_SECONDARY_MARKET: 'true',
        JPT_APPROVAL_REF_SECONDARY_MARKET: 'anything',
      }),
    ).toThrow(/BLOCKED/);
  });

  it('lets operators switch prototype modules off', () => {
    expect(resolveModuleState('INVESTMENT_SIMULATOR', { JPT_ENABLE_INVESTMENT_SIMULATOR: 'false' }).enabled).toBe(false);
  });
});
