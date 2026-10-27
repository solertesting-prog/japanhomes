import { FeaturedProperties, HowItWorks, RiskStrip, WhyJapan } from '@/components/home/sections';
import { Hero } from '@/components/home/hero';
import { StatsBand } from '@/components/home/stats-band';
import { getDataSource } from '@/lib/data';

export const revalidate = 60;

export default async function HomePage() {
  const data = getDataSource();
  const [stats, featured] = await Promise.all([
    data.getStats(),
    data.listProperties({ featured: true, sort: 'featured', page: 1, pageSize: 6 }),
  ]);
  // The hero facade charts the brief's worked example when it is listed,
  // otherwise the first open featured offering.
  const example =
    featured.items.find((p) => p.slug === 'tokyo-shibuya-apartment') ??
    featured.items.find((p) => p.fundingStatus === 'OPEN') ??
    featured.items[0] ??
    null;

  return (
    <>
      <Hero example={example} />
      <StatsBand stats={stats} />
      <FeaturedProperties properties={featured.items.slice(0, 3)} />
      <HowItWorks />
      <WhyJapan />
      <RiskStrip />
    </>
  );
}
