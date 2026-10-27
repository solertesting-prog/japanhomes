import { bpsToPercentString } from '@jpt/shared';
import { INTL_LOCALE, type Locale } from '@/i18n';

/**
 * Display formatting. Inputs are wire strings (integer yen) or bigint; Intl
 * formats bigint natively, so no float conversion happens on money.
 */
export function createFormatters(locale: Locale) {
  const tag = INTL_LOCALE[locale];
  const yenFmt = new Intl.NumberFormat(tag, { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });
  const intFmt = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const compactYen = new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'JPY',
    notation: 'compact',
    maximumFractionDigits: 2,
  });
  const dateFmt = new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' });
  const monthFmt = new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', timeZone: 'Asia/Tokyo' });

  const big = (v: string | bigint) => (typeof v === 'bigint' ? v : BigInt(v));

  return {
    yen: (v: string | bigint) => yenFmt.format(big(v)),
    /** Compact for headline figures (¥1.2B / ¥12億). Display only. */
    yenCompact: (v: string | bigint) => compactYen.format(big(v)),
    int: (v: string | bigint | number) => intFmt.format(typeof v === 'number' ? v : big(v)),
    /** Basis points → "5.12%" with the locale's decimal separator. */
    pct: (bps: number, decimals = 2) => {
      const s = bpsToPercentString(bps, decimals);
      const localized = locale === 'es' ? s.replace('.', ',') : s;
      return locale === 'es' ? `${localized} %` : `${localized}%`;
    },
    /** Parts-per-million → percentage with up to 4 decimals. */
    ppm: (ppm: string | bigint) => {
      const v = big(ppm);
      const whole = v / 10_000n;
      const frac = (v % 10_000n).toString().padStart(4, '0').replace(/0+$/, '');
      const sep = locale === 'es' ? ',' : '.';
      const body = frac ? `${whole}${sep}${frac}` : `${whole}`;
      return locale === 'es' ? `${body} %` : `${body}%`;
    },
    area: (m2: number) => `${new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(m2)} m²`,
    date: (iso: string | Date) => dateFmt.format(typeof iso === 'string' ? new Date(iso) : iso),
    month: (iso: string | Date) => monthFmt.format(typeof iso === 'string' ? new Date(iso) : iso),
  };
}

export type Formatters = ReturnType<typeof createFormatters>;
