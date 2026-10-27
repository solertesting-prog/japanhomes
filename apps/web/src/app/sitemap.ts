import type { MetadataRoute } from 'next';
import { getDataSource } from '@/lib/data';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getDataSource()
    .allSlugs()
    .catch(() => [] as string[]);
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/properties`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/risks`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    ...slugs.map((slug) => ({
      url: `${SITE_URL}/properties/${slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
