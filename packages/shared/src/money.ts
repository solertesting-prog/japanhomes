/**
 * Money primitives.
 *
 * Rules (enforced everywhere in the platform):
 *  - JPY amounts are integer yen held in `bigint`. JPY has no minor unit.
 *  - Rates are integer basis points (1 bp = 0.01 %, 10_000 bps = 100 %).
 *  - Economic ownership shares are integer parts-per-million (1_000_000 ppm = 100 %).
 *  - No floating point is used for any monetary value. Floats appear only when a
 *    value leaves the domain for display (e.g. chart coordinates).
 *  - On the wire (JSON), money travels as a decimal string: "30000000".
 */

export type Yen = bigint;
export type Bps = number;
export type Ppm = bigint;

export const BPS_DENOMINATOR = 10_000n;
export const PPM_DENOMINATOR = 1_000_000n;

export type Rounding = 'floor' | 'ceil' | 'half-even';

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** Parse integer yen from a string, number or bigint. Rejects fractions and non-finite input. */
export function yen(value: string | number | bigint): Yen {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new MoneyError(`Yen amount must be a safe integer, received ${value}`);
    }
    return BigInt(value);
  }
  const trimmed = value.trim().replace(/[_,]/g, '');
  if (!/^-?\d+$/.test(trimmed)) {
    throw new MoneyError(`Invalid yen amount "${value}": JPY amounts are whole yen`);
  }
  return BigInt(trimmed);
}

/** Validates a basis-point rate. */
export function bps(value: number): Bps {
  if (!Number.isInteger(value)) throw new MoneyError(`Basis points must be an integer, received ${value}`);
  return value;
}

/** a * b / c with explicit rounding. Integer-only; c must be > 0. */
export function mulDiv(a: bigint, b: bigint, c: bigint, rounding: Rounding = 'floor'): bigint {
  if (c <= 0n) throw new MoneyError('Division by zero or negative denominator');
  const numerator = a * b;
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  let q = abs / c;
  const r = abs % c;

  if (r !== 0n) {
    switch (rounding) {
      case 'floor':
        if (negative) q += 1n;
        break;
      case 'ceil':
        if (!negative) q += 1n;
        break;
      case 'half-even': {
        const twice = r * 2n;
        if (twice > c || (twice === c && q % 2n === 1n)) q += 1n;
        break;
      }
    }
  }
  return negative ? -q : q;
}

/** Apply a basis-point rate to an amount. */
export function applyBps(amount: Yen, rate: Bps, rounding: Rounding = 'half-even'): Yen {
  return mulDiv(amount, BigInt(rate), BPS_DENOMINATOR, rounding);
}

/** numerator / denominator expressed in basis points. */
export function ratioToBps(numerator: bigint, denominator: bigint, rounding: Rounding = 'half-even'): Bps {
  if (denominator === 0n) return 0;
  return Number(mulDiv(numerator, BPS_DENOMINATOR, denominator, rounding));
}

/** numerator / denominator expressed in parts per million. */
export function ratioToPpm(numerator: bigint, denominator: bigint, rounding: Rounding = 'floor'): Ppm {
  if (denominator === 0n) return 0n;
  return mulDiv(numerator, PPM_DENOMINATOR, denominator, rounding);
}

export function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function sumBig(values: readonly bigint[]): bigint {
  return values.reduce((acc, v) => acc + v, 0n);
}

/**
 * Split `total` across `weights` so the parts sum exactly to `total`
 * (largest-remainder / Hamilton method, ties broken by input order).
 *
 * Used for rent distributions: every yen is accounted for, no float drift.
 */
export function allocateProRata(total: Yen, weights: readonly bigint[]): Yen[] {
  if (total < 0n) throw new MoneyError('Cannot allocate a negative total');
  if (weights.some((w) => w < 0n)) throw new MoneyError('Weights must be non-negative');
  const weightSum = sumBig(weights);
  if (weightSum === 0n) return weights.map(() => 0n);

  const base = weights.map((w) => (total * w) / weightSum);
  const remainders = weights.map((w, index) => ({ index, remainder: (total * w) % weightSum }));
  let leftover = total - sumBig(base);

  remainders.sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : a.index - b.index));
  for (const { index } of remainders) {
    if (leftover === 0n) break;
    base[index] = (base[index] ?? 0n) + 1n;
    leftover -= 1n;
  }
  return base;
}

/** Wire format helpers. */
export function toWire(value: bigint): string {
  return value.toString(10);
}

export function fromWire(value: string): bigint {
  return yen(value);
}

/** Format bps as a percentage string with fixed decimals, e.g. 512 -> "5.12". Display only. */
export function bpsToPercentString(value: Bps, decimals = 2): string {
  const negative = value < 0;
  const abs = Math.abs(value);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const fracStr = frac.toString().padStart(2, '0').slice(0, decimals);
  return `${negative ? '-' : ''}${whole}${decimals > 0 ? `.${fracStr}` : ''}`;
}
