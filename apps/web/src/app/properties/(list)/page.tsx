import type { Metadata } from 'next';
import { MarketplaceView } from '@/components/marketplace/marketplace-view';
import { getI18n } from '@/i18n/server';
import { getDataSource } from '@/lib/data';
import { parseMarketplaceQuery, type RawSearchParams } from '@/lib/query-params';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.market.title, description: t.market.lede, alternates: { canonical: '/properties' } };
}

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseMarketplaceQuery(await searchParams);
  const result = await getDataSource().listProperties(query);
  // If the page number is past the end (filters changed), show the last page.
  const safe =
    result.items.length === 0 && result.total > 0
      ? await getDataSource().listProperties({ ...query, page: result.totalPages })
      : result;
  return <MarketplaceView query={{ ...query, page: safe.page }} result={safe} />;
}
