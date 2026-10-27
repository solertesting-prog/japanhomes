import 'server-only';
import {
  computePlatformStats,
  DEMO_PROPERTIES,
  findDemoProperty,
  type Paginated,
  type PlatformStatsDto,
  type PropertyCardDto,
  type PropertyDetailDto,
  type PropertyQuery,
  queryProperties,
  toPropertyDetail,
} from '@jpt/shared';
import { notFound } from 'next/navigation';

/**
 * Data access for server components.
 *
 *   JPT_DATA_SOURCE=api   (default) reads from the NestJS API at API_URL
 *   JPT_DATA_SOURCE=demo  reads the DEMO fixtures in-process — for UI work
 *                         without Postgres. Same shared query implementation.
 */
export interface DataSource {
  listProperties(query: PropertyQuery): Promise<Paginated<PropertyCardDto>>;
  getProperty(slug: string): Promise<PropertyDetailDto | null>;
  getStats(): Promise<PlatformStatsDto>;
  allSlugs(): Promise<string[]>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function toSearchParams(query: PropertyQuery): URLSearchParams {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length) p.set(key, value.join(','));
    } else p.set(key, String(value));
  }
  return p;
}

const apiSource = (baseUrl: string): DataSource => {
  async function get<T>(path: string, revalidate: number): Promise<T | null> {
    const res = await fetch(`${baseUrl}/v1${path}`, {
      headers: { accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new ApiError(res.status, `API ${path} responded ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    async listProperties(query) {
      const data = await get<Paginated<PropertyCardDto>>(`/properties?${toSearchParams(query)}`, 30);
      if (!data) throw new ApiError(404, 'Property list endpoint missing');
      return data;
    },
    getProperty: (slug) => get<PropertyDetailDto>(`/properties/${encodeURIComponent(slug)}`, 60),
    async getStats() {
      const data = await get<PlatformStatsDto>('/stats', 60);
      if (!data) throw new ApiError(404, 'Stats endpoint missing');
      return data;
    },
    async allSlugs() {
      const data = await get<Paginated<PropertyCardDto>>('/properties?pageSize=48', 300);
      return data?.items.map((p) => p.slug) ?? [];
    },
  };
};

const demoSource: DataSource = {
  listProperties: async (query) => queryProperties(DEMO_PROPERTIES, query),
  getProperty: async (slug) => {
    const p = findDemoProperty(slug);
    return p ? toPropertyDetail(p) : null;
  },
  // No user registry exists in DEMO mode: investors are reported as unknown, never invented.
  getStats: async () => computePlatformStats(DEMO_PROPERTIES, null, new Date()),
  allSlugs: async () => DEMO_PROPERTIES.map((p) => p.slug),
};

export function getDataSource(): DataSource {
  if (process.env.JPT_DATA_SOURCE === 'demo') return demoSource;
  return apiSource(process.env.API_URL ?? 'http://127.0.0.1:4000');
}

export async function getPropertyOr404(slug: string): Promise<PropertyDetailDto> {
  const property = await getDataSource().getProperty(slug);
  if (!property) notFound();
  return property;
}
