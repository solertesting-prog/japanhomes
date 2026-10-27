'use client';

import type { PlatformStatsDto } from '@jpt/shared';
import { useI18n } from '@/i18n/provider';

export function StatsBand({ stats }: { stats: PlatformStatsDto }) {
  const { t, f } = useI18n();
  const items = [
    { label: t.stats.totalAssetValue, value: f.yenCompact(stats.totalAssetValue) },
    { label: t.stats.propertiesAvailable, value: f.int(stats.propertiesAvailable) },
    {
      label: t.stats.registeredInvestors,
      value: stats.registeredInvestors === null ? '—' : f.int(stats.registeredInvestors),
      note: stats.registeredInvestors === null ? t.stats.notTracked : undefined,
    },
    { label: t.stats.capitalFunded, value: f.yenCompact(stats.capitalFunded) },
  ];
  return (
    <section aria-label={t.stats.capitalFunded} className="border-y border-line bg-washi">
      <div className="container-page py-10">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="border-l-2 border-ink pl-4">
              <dd className="num font-display text-3xl text-ink sm:text-[2.25rem]">{item.value}</dd>
              <dt className="mt-1 text-sm text-ink-2">{item.label}</dt>
              {item.note && <p className="mt-0.5 text-xs text-ink-3">{item.note}</p>}
            </div>
          ))}
        </dl>
        <p className="mt-8 text-xs text-ink-3">
          {stats.isDemo ? t.stats.demoAsOf(f.date(stats.asOf)) : t.stats.liveAsOf(f.date(stats.asOf))}
        </p>
      </div>
    </section>
  );
}
