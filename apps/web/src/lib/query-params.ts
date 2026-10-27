import { type PropertyQuery, propertyQuerySchema } from '@jpt/shared';

export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Parses URL search params into a validated marketplace query. Invalid values
 * are dropped one by one instead of failing the whole page, so a mangled
 * shared link still shows results.
 */
export function parseMarketplaceQuery(raw: RawSearchParams): PropertyQuery {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const value = Array.isArray(v) ? v.join(',') : v;
    if (value !== undefined && value !== '') flat[k] = value;
  }
  const full = propertyQuerySchema.safeParse(flat);
  if (full.success) return full.data;

  const kept: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (propertyQuerySchema.safeParse({ ...kept, [k]: v }).success) kept[k] = v;
  }
  return propertyQuerySchema.parse(kept);
}

/** Serialises a query back to a URL, omitting defaults to keep links short. */
export function marketplaceHref(query: Partial<Record<string, string | string[] | undefined>>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    const value = Array.isArray(v) ? v.join(',') : v;
    if (!value) continue;
    if (k === 'sort' && value === 'featured') continue;
    if (k === 'page' && value === '1') continue;
    p.set(k, value);
  }
  const s = p.toString();
  return s ? `/properties?${s}` : '/properties';
}
