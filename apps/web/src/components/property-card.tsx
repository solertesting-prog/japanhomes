'use client';

import type { PropertyCardDto } from '@jpt/shared';
import { Progress } from '@jpt/ui';
import Link from 'next/link';
import { useI18n } from '@/i18n/provider';
import { FavoriteButton } from './favorite-button';
import { PropertyArt } from './property-art';
import { DemoBadge, StatusBadge } from './status-badge';

export function PropertyCard({ property: p, priority = false }: { property: PropertyCardDto; priority?: boolean }) {
  const { t, f } = useI18n();
  const sold = BigInt(p.totalTokens) - BigInt(p.tokensAvailable);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper transition-[border-color] duration-200 hover:border-line-strong">
      <div className="relative aspect-[400/260] overflow-hidden border-b border-line">
        <PropertyArt slug={p.slug} type={p.type} title={`${p.name} — ${t.property.illustration}`} className="h-full w-full" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <StatusBadge status={p.fundingStatus} label={t.status[p.fundingStatus] ?? p.fundingStatus} />
          {p.isDemo && <DemoBadge />}
        </div>
        <FavoriteButton slug={p.slug} name={p.name} className="absolute right-3 top-3 z-10" />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="flex flex-wrap justify-between gap-x-3 text-[0.8125rem] text-ink-3">
            <span>
              {p.neighborhood}, {t.cities[p.city] ?? p.city}
            </span>
            <span>{t.types[p.type] ?? p.type}</span>
          </p>
          <h3 className="mt-1 font-display text-lg leading-snug text-ink">
            <Link
              href={`/properties/${p.slug}`}
              prefetch={priority}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-has-[:focus-visible]:underline"
            >
              {p.name}
            </Link>
          </h3>
        </div>

        <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-xs text-ink-3">{t.card.price}</dt>
            <dd className="num mt-0.5 font-medium text-ink">{f.yenCompact(p.purchasePrice)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">{t.card.minInvestment}</dt>
            <dd className="num mt-0.5 font-medium text-ink">{f.yen(p.minimumInvestment)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">{t.card.estYield}</dt>
            <dd className="num mt-0.5 font-medium text-ink">{f.pct(p.investorYieldBps)}</dd>
          </div>
        </dl>

        <div className="mt-auto space-y-2">
          <Progress valueBps={p.fundedBps} label={t.property.funded(f.pct(p.fundedBps, 0))} />
          <div className="flex flex-wrap justify-between gap-x-3 text-xs text-ink-2">
            <span className="num">{t.property.funded(f.pct(p.fundedBps, 0))}</span>
            <span className="num">{t.card.tokensOf(f.int(sold), f.int(p.totalTokens))}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
