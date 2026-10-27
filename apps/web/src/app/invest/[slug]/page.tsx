import type { Metadata } from 'next';
import { InvestFlow } from '@/components/app/invest-flow';
import { getPropertyOr404 } from '@/lib/data';

export const metadata: Metadata = { title: 'Invest', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getPropertyOr404(slug);
  return <InvestFlow property={property} />;
}
