import type { Metadata } from 'next';
import { PropertyDetail } from '@/components/property/property-detail';
import { getI18n } from '@/i18n/server';
import { getDataSource, getPropertyOr404 } from '@/lib/data';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getDataSource().getProperty(slug);
  const { t } = await getI18n();
  if (!p) return { title: t.info.notFoundTitle };
  const title = `${p.name}${p.isDemo ? ' (DEMO)' : ''}`;
  return {
    title,
    description: p.summary,
    alternates: { canonical: `/properties/${p.slug}` },
    openGraph: { title, description: p.summary, type: 'article' },
  };
}

export default async function PropertyPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const property = await getPropertyOr404(slug);
  return <PropertyDetail property={property} />;
}
