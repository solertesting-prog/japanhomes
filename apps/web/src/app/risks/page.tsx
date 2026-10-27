import type { Metadata } from 'next';
import { InfoPage } from '@/components/info-page';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.risks };
}

export default async function RisksPage() {
  const { t } = await getI18n();
  return (
    <InfoPage title={t.riskStrip.title}>
      <p className="text-lg text-ink">{t.riskStrip.body}</p>
      <ul className="divide-y divide-line border-y border-line">
        {t.why.cons.map((risk) => (
          <li key={risk.title} className="py-5">
            <p className="font-medium text-ink">{risk.title}</p>
            <p className="mt-1 text-sm">{risk.body}</p>
          </li>
        ))}
        <li className="py-5">
          <p className="font-medium text-ink">{t.property.yields}</p>
          <p className="mt-1 text-sm">{t.simulator.lede}</p>
        </li>
      </ul>
      <p className="text-sm text-ink-3">{t.info.draft}</p>
    </InfoPage>
  );
}
