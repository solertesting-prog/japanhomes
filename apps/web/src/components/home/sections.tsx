'use client';

import type { PropertyCardDto } from '@jpt/shared';
import Link from 'next/link';
import { useI18n } from '@/i18n/provider';
import { PropertyCard } from '../property-card';

export function FeaturedProperties({ properties }: { properties: PropertyCardDto[] }) {
  const { t } = useI18n();
  if (!properties.length) return null;
  return (
    <section className="container-page py-20" aria-labelledby="featured-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 id="featured-title" className="font-display text-3xl text-ink sm:text-4xl">
            {t.featured.title}
          </h2>
          <p className="mt-3 text-ink-2">{t.featured.lede}</p>
        </div>
        <Link href="/properties" className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu">
          {t.featured.viewAll}
        </Link>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p, i) => (
          <PropertyCard key={p.id} property={p} priority={i < 3} />
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-ink text-paper" aria-labelledby="how-title">
      <div className="container-page py-20">
        <div className="max-w-2xl">
          <h2 id="how-title" className="font-display text-3xl sm:text-4xl">
            {t.how.title}
          </h2>
          <p className="mt-3 leading-relaxed text-paper/70">{t.how.lede}</p>
        </div>
        {/* A real sequence, so it is numbered. */}
        <ol className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-paper/15 sm:grid-cols-2 lg:grid-cols-3">
          {t.how.steps.map((step, i) => (
            <li key={step.title} className="bg-ink p-6 sm:p-7">
              <span className="num font-display text-2xl text-shu">{i + 1}</span>
              <h3 className="mt-3 text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/70">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function WhyJapan() {
  const { t } = useI18n();
  return (
    <section className="container-page py-20" aria-labelledby="why-title">
      <div className="max-w-2xl">
        <h2 id="why-title" className="font-display text-3xl text-ink sm:text-4xl">
          {t.why.title}
        </h2>
        <p className="mt-3 text-ink-2">{t.why.lede}</p>
      </div>
      <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
        {[
          { heading: t.why.forTitle, items: t.why.pros, mark: 'bg-ink' },
          { heading: t.why.against, items: t.why.cons, mark: 'bg-shu' },
        ].map((col) => (
          <div key={col.heading}>
            <h3 className="flex items-center gap-3 text-base font-medium text-ink">
              <span aria-hidden className={`h-3 w-3 ${col.mark}`} />
              {col.heading}
            </h3>
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {col.items.map((item) => (
                <li key={item.title} className="py-5">
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-ink-3">{t.why.sourceNote}</p>
    </section>
  );
}

export function RiskStrip() {
  const { t } = useI18n();
  return (
    <section className="border-t border-line bg-washi">
      <div className="container-page flex flex-col gap-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-medium text-ink">{t.riskStrip.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{t.riskStrip.body}</p>
        </div>
        <Link href="/risks" className="shrink-0 text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu">
          {t.riskStrip.link}
        </Link>
      </div>
    </section>
  );
}
