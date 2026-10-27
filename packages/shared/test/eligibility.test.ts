import { describe, expect, it } from 'vitest';
import { registerSchema } from '../src/auth';
import { assessEligibility, type EligibilityInput } from '../src/eligibility';

const now = new Date('2026-10-27T00:00:00Z');
const ok: EligibilityInput = {
  kycStatus: 'APPROVED',
  kycExpiresAt: new Date('2027-10-27T00:00:00Z'),
  sanctionsMatch: false,
  pepMatch: false,
  countryOfResidence: 'ES',
  isEntity: false,
  beneficialOwnersVerified: false,
  crossBorderEnabled: false,
  now,
};

describe('assessEligibility', () => {
  it('lets a verified non-resident use simulations only while cross-border is off', () => {
    const a = assessEligibility(ok);
    expect(a.simulatedAllowed).toBe(true);
    expect(a.realAllowed).toBe(false);
  });

  it('allows real offerings for Japan residents', () => {
    expect(assessEligibility({ ...ok, countryOfResidence: 'JP' }).realAllowed).toBe(true);
  });

  it('allows non-residents for real offerings only once cross-border is enabled', () => {
    expect(assessEligibility({ ...ok, crossBorderEnabled: true }).realAllowed).toBe(true);
  });

  it('blocks unapproved, expired, sanctioned and blocked-jurisdiction investors', () => {
    expect(assessEligibility({ ...ok, kycStatus: 'UNDER_REVIEW' }).simulatedAllowed).toBe(false);
    expect(assessEligibility({ ...ok, kycExpiresAt: new Date('2026-01-01T00:00:00Z') }).simulatedAllowed).toBe(false);
    expect(assessEligibility({ ...ok, sanctionsMatch: true }).simulatedAllowed).toBe(false);
    expect(assessEligibility({ ...ok, countryOfResidence: 'KP' }).simulatedAllowed).toBe(false);
    expect(assessEligibility({ ...ok, countryOfResidence: null }).simulatedAllowed).toBe(false);
  });

  it('requires verified beneficial owners for entities', () => {
    expect(assessEligibility({ ...ok, isEntity: true }).simulatedAllowed).toBe(false);
    expect(assessEligibility({ ...ok, isEntity: true, beneficialOwnersVerified: true }).simulatedAllowed).toBe(true);
  });

  it('flags PEPs for enhanced due diligence without auto-rejecting', () => {
    const a = assessEligibility({ ...ok, pepMatch: true });
    expect(a.requiresEnhancedDueDiligence).toBe(true);
    expect(a.simulatedAllowed).toBe(true);
  });
});

describe('registerSchema', () => {
  const base = { email: '  Ana@Example.COM ', password: 'correct horse battery', acceptTerms: true, acceptPrivacy: true };
  it('normalises email and accepts a long passphrase', () => {
    expect(registerSchema.parse(base).email).toBe('ana@example.com');
  });
  it('rejects short or repetitive passwords and missing consent', () => {
    expect(() => registerSchema.parse({ ...base, password: 'short' })).toThrow();
    expect(() => registerSchema.parse({ ...base, password: 'aaaaaaaaaaaaaaaa' })).toThrow();
    expect(() => registerSchema.parse({ ...base, acceptTerms: false })).toThrow();
  });
});
