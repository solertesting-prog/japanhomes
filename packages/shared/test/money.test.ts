import { describe, expect, it } from 'vitest';
import {
  allocateProRata,
  applyBps,
  bpsToPercentString,
  mulDiv,
  ratioToBps,
  ratioToPpm,
  yen,
} from '../src/money';

describe('yen()', () => {
  it('parses whole yen from strings with separators', () => {
    expect(yen('30,000,000')).toBe(30_000_000n);
    expect(yen('1_000')).toBe(1_000n);
  });

  it('rejects fractional and non-numeric input', () => {
    expect(() => yen('100.5')).toThrow(/whole yen/);
    expect(() => yen('abc')).toThrow();
    expect(() => yen(1.5)).toThrow();
    expect(() => yen(Number.MAX_SAFE_INTEGER + 2)).toThrow();
  });
});

describe('mulDiv rounding', () => {
  it('floors, ceils and rounds half to even', () => {
    expect(mulDiv(7n, 1n, 2n, 'floor')).toBe(3n);
    expect(mulDiv(7n, 1n, 2n, 'ceil')).toBe(4n);
    expect(mulDiv(5n, 1n, 2n, 'half-even')).toBe(2n);
    expect(mulDiv(7n, 1n, 2n, 'half-even')).toBe(4n);
    expect(mulDiv(-7n, 1n, 2n, 'floor')).toBe(-4n);
  });

  it('refuses a zero denominator', () => {
    expect(() => mulDiv(1n, 1n, 0n)).toThrow();
  });
});

describe('rates', () => {
  it('applies basis points without floats', () => {
    expect(applyBps(1_536_000n, 500)).toBe(76_800n);
    expect(applyBps(30_000_000n, 50)).toBe(150_000n);
  });

  it('expresses ratios in bps and ppm', () => {
    expect(ratioToBps(1_536_000n, 30_000_000n)).toBe(512);
    expect(ratioToPpm(100n, 30_000n)).toBe(3_333n);
  });

  it('formats bps for display', () => {
    expect(bpsToPercentString(512)).toBe('5.12');
    expect(bpsToPercentString(5)).toBe('0.05');
    expect(bpsToPercentString(-1_250)).toBe('-12.50');
  });
});

describe('allocateProRata', () => {
  it('allocates every yen exactly', () => {
    const parts = allocateProRata(1_000n, [1n, 1n, 1n]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(1_000n);
    expect(parts).toEqual([334n, 333n, 333n]);
  });

  it('is proportional for uneven holdings', () => {
    const parts = allocateProRata(200_000n, [100n, 2_900n, 27_000n]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(200_000n);
    expect(parts[0]).toBe(667n);
  });

  it('returns zeros when nobody holds tokens', () => {
    expect(allocateProRata(500n, [0n, 0n])).toEqual([0n, 0n]);
  });
});
