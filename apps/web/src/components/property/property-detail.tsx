'use client';

import {
  applyScenario,
  computeOfferingMetrics,
  DEFAULT_SCENARIOS,
  type PropertyDetailDto,
} from '@jpt/shared';
import { Badge, buttonVariants, cn, IconChevronLeft, IconExternal, IconFile, IconLock, IconTrain, Progress } from '@jpt/ui';
import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { financialsFromDto } from '@/lib/financials';
import { PropertyArt } from '../property-art';
import { DemoBadge, StatusBadge } from '../status-badge';
import { FavoriteButton } from '../favorite-button';
import { InvestmentSimulator } from './simulator';

const STRUCTURE_LABEL: Record<string, string> = {
  TRUST_BENEFICIARY_INTEREST: 'Trust beneficiary interest (信託受益権)',
  GK_TK_SILENT_PARTNERSHIP: 'GK–TK silent partnership (匿名組合)',
  TOKUTEI_KYODO_JIGYO: 'Real Estate Specified Joint Enterprise (不動産特定共同事業)',
  TMK_PREFERRED_EQUITY: 'TMK preferred equity (優先出資)',
};

export function PropertyDetail({ property: p }: { property: PropertyDetailDto }) {
  const { t } = useI18n();
  return (
    <article className="pb-28 lg:pb-24">
      <div className="container-page pt-8">
        <Link href="/properties" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
          <IconChevronLeft size={16} /> {t.property.back}
        </Link>
        <TitleBlock p={p} />
      </div>

      <div className="container-page mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 space-y-16 lg:col-span-8">
          <Gallery p={p} />
          <About p={p} />
          <KeyFacts p={p} />
          <Financials p={p} />
          <InvestmentSimulator property={p} />
          <TokenSection p={p} />
          <Distributions p={p} />
          <Documents p={p} />
          <Location p={p} />
          <Risks p={p} />
        </div>
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24">
            <InvestPanel p={p} />
          </div>
        </aside>
      </div>

      <MobileInvestBar p={p} />
    </article>
  );
}

/* ------------------------------------------------------------------------ */

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <h2 id={id} className="font-display text-2xl text-ink">
        {title}
      </h2>
      {lede && <p className="mt-1.5 text-sm text-ink-2">{lede}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TitleBlock({ p }: { p: PropertyDetailDto }) {
  const { t } = useI18n();
  return (
    <header className="mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={p.fundingStatus} label={t.status[p.fundingStatus] ?? p.fundingStatus} />
          {p.isDemo && <DemoBadge />}
          <Badge>{t.types[p.type]}</Badge>
        </div>
        <h1 className="mt-4 font-display text-[2rem] leading-tight text-ink sm:text-[2.5rem]">{p.name}</h1>
        <p className="mt-2 text-ink-2">
          {p.approximateAddress} — {t.prefectures[p.prefecture]}
        </p>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-2">{p.summary}</p>
      </div>
      <FavoriteButton slug={p.slug} name={p.name} className="h-11 w-11 border border-line" />
    </header>
  );
}

function Gallery({ p }: { p: PropertyDetailDto }) {
  const { t } = useI18n();
  const views = ['elevation', 'plan', 'area'] as const;
  const [active, setActive] = useState<(typeof views)[number]>('elevation');
  return (
    <figure>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
        <PropertyArt slug={p.slug} type={p.type} variant={active} title={`${p.name} — ${t.property.illustration}`} className="aspect-[400/260] h-auto w-full" />
      </div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="flex gap-2" role="tablist" aria-label={t.property.illustration}>
          {views.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={active === v}
              onClick={() => setActive(v)}
              className={cn('w-20 overflow-hidden rounded-md border-2 transition-colors', active === v ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              <PropertyArt slug={p.slug} type={p.type} variant={v} title={v} className="aspect-[400/260] h-auto w-full" />
            </button>
          ))}
        </div>
        <figcaption className="text-right text-xs text-ink-3">{t.property.illustration}</figcaption>
      </div>
    </figure>
  );
}

function About({ p }: { p: PropertyDetailDto }) {
  const { t } = useI18n();
  return (
    <Section id="about" title={t.property.about}>
      <p className="max-w-[68ch] leading-[1.8] text-ink-2">{p.description}</p>
      {p.highlights.length > 0 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {p.highlights.map((h) => (
            <li key={h} className="border-l-2 border-shu pl-3 text-sm text-ink">
              {h}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function KeyFacts({ p }: { p: PropertyDetailDto }) {
  const { t, f } = useI18n();
  const facts: Array<[string, ReactNode]> = [
    [t.property.floorArea, f.area(p.floorAreaM2)],
    ...(p.landAreaM2 !== null ? ([[t.property.landArea, f.area(p.landAreaM2)]] as Array<[string, ReactNode]>) : []),
    [t.property.yearBuilt, String(p.yearBuilt)],
    [t.property.structure, p.structure],
    ...(p.layout ? ([[t.property.layout, p.layout]] as Array<[string, ReactNode]>) : []),
    [t.property.condition, t.condition[p.condition]],
    [t.property.rentalStatus, t.rental[p.rentalStatus]],
    [t.property.occupancy, f.pct(p.occupancyBps, 0)],
    [
      t.property.station,
      <span key="st" className="inline-flex items-center gap-1.5">
        <IconTrain size={15} className="text-ink-3" /> {p.nearestStation}, {t.property.walk(p.walkMinutes)}
      </span>,
    ],
  ];
  return (
    <Section id="facts" title={t.property.keyFacts}>
      <dl className="grid grid-cols-1 border-t border-line sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-line py-3 text-sm sm:odd:pr-6 sm:even:pl-6">
            <dt className="text-ink-2">{label}</dt>
            <dd className="text-right text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-ink-3">
        {t.property.valuation(f.yen(p.valuation.appraisedValue), f.date(p.valuation.appraisedAt))} — {p.valuation.appraiser}
      </p>
    </Section>
  );
}

function Financials({ p }: { p: PropertyDetailDto }) {
  const { t, f } = useI18n();
  const fin = p.financials;
  const total = BigInt(fin.totalCapital);
  const stack = [
    { label: t.property.purchasePrice, value: fin.purchasePrice, cls: 'bg-ink' },
    { label: t.property.acquisitionCosts, value: fin.acquisitionCosts, cls: 'bg-ai' },
    { label: t.property.renovationCosts, value: fin.renovationCosts, cls: 'bg-kincha' },
    { label: t.property.reserves, value: fin.reserves, cls: 'bg-matcha' },
  ].filter((s) => BigInt(s.value) > 0n);

  const scenarios = useMemo(() => {
    const base = financialsFromDto(p);
    return DEFAULT_SCENARIOS.map((s) => {
      const sf = applyScenario(base, s);
      const m = computeOfferingMetrics(sf);
      return { key: s.key, occupancyBps: sf.occupancyBps, distributable: m.estimatedDistributable, yieldBps: m.investorYieldBps };
    });
  }, [p]);

  const vacancy = BigInt(fin.annualGrossRent) - BigInt(fin.effectiveGrossIncome);
  const income: Array<{ label: string; value: bigint; kind?: 'sub' | 'total' | 'minus' }> = [
    { label: t.property.grossRent, value: BigInt(fin.annualGrossRent) },
    { label: t.property.vacancy(f.pct(fin.occupancyBps, 0)), value: -vacancy, kind: 'minus' },
    { label: t.property.egi, value: BigInt(fin.effectiveGrossIncome), kind: 'sub' },
    { label: t.property.opex, value: -BigInt(fin.annualOperatingExpenses), kind: 'minus' },
    { label: t.property.propertyTax, value: -BigInt(fin.annualPropertyTax), kind: 'minus' },
    { label: t.property.pmFee(f.pct(fin.propertyManagementFeeBps, 1)), value: -BigInt(fin.propertyManagementFee), kind: 'minus' },
    { label: t.property.noi, value: BigInt(fin.netOperatingIncome), kind: 'sub' },
    { label: t.property.platformFee(f.pct(fin.platformFeeBps, 2)), value: -BigInt(fin.platformFee), kind: 'minus' },
    { label: t.property.distributable, value: BigInt(fin.estimatedDistributable), kind: 'total' },
  ];

  return (
    <Section id="financials" title={t.property.financials}>
      {/* Capital stack */}
      <h3 className="text-sm font-medium text-ink">{t.property.capital}</h3>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full" aria-hidden>
        {stack.map((s) => (
          <div key={s.label} className={s.cls} style={{ width: `${Number((BigInt(s.value) * 10_000n) / total) / 100}%` }} />
        ))}
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        {stack.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-ink-2">
              <span aria-hidden className={cn('h-2.5 w-2.5 rounded-sm', s.cls)} />
              {s.label}
            </dt>
            <dd className="num text-ink">{f.yen(s.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-line pt-2 font-medium">
          <dt className="text-ink">{t.property.totalCapital}</dt>
          <dd className="num text-ink">{f.yen(fin.totalCapital)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink-3">
        {f.int(p.totalTokens)} × {f.yen(p.tokenPrice)} = {f.yen(fin.totalCapital)}
      </p>

      {/* Income statement */}
      <h3 className="mt-10 text-sm font-medium text-ink">{t.property.incomeTitle}</h3>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {income.map((row) => (
            <tr
              key={row.label}
              className={cn(
                'border-b border-line',
                row.kind === 'sub' && 'font-medium',
                row.kind === 'total' && 'border-b-0 border-t-2 border-t-ink font-medium',
              )}
            >
              <th scope="row" className={cn('py-2.5 pr-4 text-left font-normal', row.kind === 'minus' ? 'pl-4 text-ink-2' : 'text-ink', row.kind && row.kind !== 'minus' && 'font-medium')}>
                {row.label}
              </th>
              <td className={cn('num py-2.5 text-right', row.kind === 'minus' ? 'text-ink-2' : 'text-ink')}>{f.yen(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Yields */}
      <h3 className="mt-10 text-sm font-medium text-ink">{t.property.yields}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          { label: t.property.grossYield, hint: t.property.grossYieldHint, bps: fin.grossYieldBps },
          { label: t.property.netYield, hint: t.property.netYieldHint, bps: fin.netYieldBps },
          { label: t.property.investorYield, hint: t.property.investorYieldHint, bps: fin.investorYieldBps, accent: true },
        ].map((y) => (
          <div key={y.label} className={cn('rounded-lg border p-4', y.accent ? 'border-ink' : 'border-line')}>
            <p className="text-sm text-ink-2">{y.label}</p>
            <p className="num mt-1 font-display text-[1.75rem] text-ink">{f.pct(y.bps)}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">{y.hint}</p>
          </div>
        ))}
      </div>

      {/* Sensitivity */}
      <h3 className="mt-10 text-sm font-medium text-ink">{t.property.sensitivity}</h3>
      <p className="mt-1 text-xs text-ink-3">{t.property.sensitivityLede}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th scope="col" className="py-2 font-normal" />
              <th scope="col" className="py-2 font-normal">{t.property.occupancyCol}</th>
              <th scope="col" className="py-2 text-right font-normal">{t.property.distributableCol}</th>
              <th scope="col" className="py-2 text-right font-normal">{t.property.yieldCol}</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.key} className={cn('border-b border-line', s.key === 'base' && 'font-medium')}>
                <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                  <span className={cn('text-ink', s.key === 'base' && 'font-medium')}>{t.property.scenario[s.key]}</span>
                  <span className="block text-xs text-ink-3">{t.property.scenarioAssumptions[s.key]}</span>
                </th>
                <td className="num py-2.5 text-ink">{f.pct(s.occupancyBps, 0)}</td>
                <td className="num py-2.5 text-right text-ink">{f.yen(s.distributable)}</td>
                <td className="num py-2.5 text-right text-ink">{f.pct(s.yieldBps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function TokenSection({ p }: { p: PropertyDetailDto }) {
  const { t, f } = useI18n();
  const rows: Array<[string, ReactNode]> = [
    [t.property.tokenName, p.token.name],
    [t.property.symbol, <span key="s" className="num">{p.token.symbol}</span>],
    [t.property.network, p.token.network],
    [t.property.contract, p.token.contractAddress ? <code key="c" className="break-all text-xs">{p.token.contractAddress}</code> : t.property.notDeployed],
    [t.property.standard, p.token.standard],
    [t.property.supply, f.int(p.token.totalSupply)],
    [t.property.available, f.int(p.token.tokensAvailable)],
    [t.property.tokenPrice, f.yen(p.tokenPrice)],
    [t.property.legalStructure, STRUCTURE_LABEL[p.legalStructure] ?? p.legalStructure],
  ];
  return (
    <Section id="token" title={t.property.token}>
      <p className="rounded-lg bg-washi p-4 text-sm leading-relaxed text-ink-2">{t.property.tokenNotice}</p>
      <dl className="mt-5 border-t border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 border-b border-line py-3 text-sm sm:grid-cols-[14rem_1fr]">
            <dt className="text-ink-2">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
        <div className="grid gap-1 border-b border-line py-3 text-sm sm:grid-cols-[14rem_1fr]">
          <dt className="text-ink-2">{t.property.rights}</dt>
          <dd className="leading-relaxed text-ink">{p.token.economicRights}</dd>
        </div>
        <div className="grid gap-1 border-b border-line py-3 text-sm sm:grid-cols-[14rem_1fr]">
          <dt className="text-ink-2">{t.property.restrictions}</dt>
          <dd className="leading-relaxed text-ink">{p.token.transferRestrictions}</dd>
        </div>
      </dl>
    </Section>
  );
}

function Distributions({ p }: { p: PropertyDetailDto }) {
  const { t, f } = useI18n();
  return (
    <Section id="distributions" title={t.property.distributions} lede={t.property.distributionsLede}>
      {p.distributions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-5 text-sm text-ink-2">{t.property.noDistributions}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th scope="col" className="py-2 font-normal">{t.property.period}</th>
                <th scope="col" className="py-2 font-normal">{t.property.paidOn}</th>
                <th scope="col" className="py-2 text-right font-normal">{t.property.perToken}</th>
                <th scope="col" className="py-2 text-right font-normal">{t.property.total}</th>
              </tr>
            </thead>
            <tbody>
              {p.distributions.map((d) => (
                <tr key={d.id} className="border-b border-line">
                  <td className="py-2.5 text-ink">
                    {f.month(d.periodStart)} – {f.month(d.periodEnd)}
                  </td>
                  <td className="py-2.5 text-ink-2">{f.date(d.paidAt)}</td>
                  <td className="num py-2.5 text-right text-ink">{f.yen(d.amountPerToken)}</td>
                  <td className="num py-2.5 text-right text-ink">{f.yen(d.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.isDemo && <p className="mt-2 text-xs text-ink-3">DEMO</p>}
        </div>
      )}
    </Section>
  );
}

function Documents({ p }: { p: PropertyDetailDto }) {
  const { t } = useI18n();
  return (
    <Section id="documents" title={t.property.documents} lede={t.property.documentsLede}>
      <ul className="divide-y divide-line border-y border-line">
        {p.documents.map((d) => {
          const locked = d.accessLevel !== 'PUBLIC';
          return (
            <li key={d.id} className="flex items-center gap-4 py-3.5">
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', locked ? 'bg-washi text-ink-3' : 'bg-ink text-paper')}>
                {locked ? <IconLock size={16} /> : <IconFile size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{d.title}</p>
                <p className="text-xs text-ink-3">
                  PDF, {d.sizeKb.toLocaleString()} KB — {t.property.access[d.accessLevel]}
                </p>
              </div>
              <span className="hidden text-xs text-ink-3 sm:block" title={t.property.demoFile}>
                {p.isDemo ? t.property.demoFile : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function Location({ p }: { p: PropertyDetailDto }) {
  const { t } = useI18n();
  const osm = `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=14/${p.latitude}/${p.longitude}`;
  return (
    <Section id="location" title={t.property.location} lede={t.property.locationNote}>
      <div className="grid gap-5 sm:grid-cols-[1fr_16rem]">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
          <PropertyArt slug={p.slug} type={p.type} variant="area" title={`${p.neighborhood}, ${t.cities[p.city]}`} className="aspect-[400/260] h-auto w-full" />
        </div>
        <div className="text-sm">
          <p className="text-ink">{p.approximateAddress}</p>
          <p className="mt-1 flex items-center gap-1.5 text-ink-2">
            <IconTrain size={15} /> {p.nearestStation}, {t.property.walk(p.walkMinutes)}
          </p>
          <p className="num mt-3 text-xs text-ink-3">
            {p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}
          </p>
          <a href={osm} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu">
            {t.property.openMap} <IconExternal size={14} />
          </a>
        </div>
      </div>
    </Section>
  );
}

function Risks({ p }: { p: PropertyDetailDto }) {
  const { t } = useI18n();
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const risks = [...p.risks].sort((a, b) => order[a.level] - order[b.level]);
  return (
    <Section id="risks" title={t.property.risks}>
      <ul className="divide-y divide-line border-y border-line">
        {risks.map((r) => (
          <li key={r.title} className="grid gap-1 py-4 sm:grid-cols-[7rem_1fr]">
            <span className={cn('text-xs font-medium', r.level === 'HIGH' ? 'text-shu-deep' : r.level === 'MEDIUM' ? 'text-kincha' : 'text-ink-3')}>
              {t.property.riskLevel[r.level]}
            </span>
            <div>
              <p className="text-sm font-medium text-ink">{r.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function InvestCta({ p, className }: { p: PropertyDetailDto; className?: string }) {
  const { t } = useI18n();
  if (p.fundingStatus !== 'OPEN') {
    return (
      <p className={cn('rounded-lg bg-washi px-4 py-3 text-center text-sm text-ink-2', className)}>
        {t.property.investUnavailable[p.fundingStatus]}
      </p>
    );
  }
  return (
    <Link href={`/invest/${p.slug}`} className={cn(buttonVariants({ variant: 'shu', size: 'lg' }), 'w-full', className)}>
      {t.property.invest}
    </Link>
  );
}

function InvestPanel({ p }: { p: PropertyDetailDto }) {
  const { t, f } = useI18n();
  const sold = BigInt(p.totalTokens) - BigInt(p.tokensAvailable);
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-6">
      <p className="text-sm text-ink-2">{t.property.tokenPrice}</p>
      <p className="num font-display text-[2.25rem] leading-tight text-ink">{f.yen(p.tokenPrice)}</p>
      <dl className="mt-5 space-y-2.5 text-sm">
        <div className="flex justify-between"><dt className="text-ink-2">{t.card.minInvestment}</dt><dd className="num text-ink">{f.yen(p.minimumInvestment)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-2">{t.property.investorYield}</dt><dd className="num text-ink">{f.pct(p.investorYieldBps)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-2">{t.property.totalCapital}</dt><dd className="num text-ink">{f.yen(p.totalCapital)}</dd></div>
      </dl>
      <div className="mt-6 space-y-2">
        <Progress valueBps={p.fundedBps} label={t.property.funded(f.pct(p.fundedBps, 1))} className="h-2" />
        <div className="flex justify-between text-xs text-ink-2">
          <span className="num">{t.property.funded(f.pct(p.fundedBps, 1))}</span>
          <span className="num">{t.card.tokensOf(f.int(sold), f.int(p.totalTokens))}</span>
        </div>
        {p.roundOpensAt && p.fundingStatus === 'COMING_SOON' && (
          <p className="text-xs text-ink-3">{t.property.roundOpens(f.date(p.roundOpensAt))}</p>
        )}
        {p.roundClosesAt && p.fundingStatus === 'OPEN' && (
          <p className="text-xs text-ink-3">{t.property.roundCloses(f.date(p.roundClosesAt))}</p>
        )}
      </div>
      <InvestCta p={p} className="mt-6" />
      {p.fundingStatus === 'OPEN' && <p className="mt-3 text-xs leading-relaxed text-ink-3">{t.property.investNote}</p>}
    </div>
  );
}

function MobileInvestBar({ p }: { p: PropertyDetailDto }) {
  const { t, f } = useI18n();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur lg:hidden">
      <div className="container-page flex items-center gap-4 py-3">
        <div className="shrink-0">
          <p className="text-xs text-ink-3">{t.property.tokenPrice}</p>
          <p className="num font-medium text-ink">{f.yen(p.tokenPrice)}</p>
        </div>
        <InvestCta p={p} className="h-11 flex-1 text-[0.9375rem]" />
      </div>
    </div>
  );
}
