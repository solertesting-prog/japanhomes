'use client';

import { Badge, buttonVariants, cn } from '@jpt/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { api } from '@/lib/client-api';
import { useRequireSession } from '@/lib/session';
import type { OrderDto } from './invest-flow';
import { Notice, PageSpinner, useErrorText } from './ui';

interface Portfolio {
  totals: { investedAmount: string; estimatedValue: string; distributionsReceived: string; projectedAnnualDistribution: string; properties: number };
  allocationByCity: Array<{ city: string; amount: string }>;
  holdings: Array<{
    offeringId: string;
    property: { slug: string; name: string; city: string; type: string; isDemo: boolean };
    tokenSymbol: string;
    tokens: string;
    investedAmount: string;
    ownershipPpm: string;
    estimatedValue: string;
    distributionsReceived: string;
    projectedAnnualDistribution: string;
    offeringStatus: string;
  }>;
}

interface Tx {
  occurredAt: string;
  type: string;
  status: string;
  reference: string;
  token: string | null;
  tokens: string | null;
  amount: string | null;
}

const OPEN_ORDER = new Set(['PENDING_DOCUMENTS', 'AWAITING_PAYMENT']);

export function DashboardView() {
  const { t, f } = useI18n();
  const d = t.app.dashboard;
  const errText = useErrorText();
  const { ready } = useRequireSession();
  const [data, setData] = useState<{ portfolio: Portfolio; txs: Tx[]; orders: OrderDto[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    Promise.all([api<Portfolio>('/me/portfolio'), api<{ items: Tx[] }>('/me/transactions'), api<OrderDto[]>('/subscriptions')])
      .then(([portfolio, txs, orders]) => setData({ portfolio, txs: txs.items, orders }))
      .catch((e) => setError(errText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (error) return <div className="container-page py-14"><Notice tone="error">{error}</Notice></div>;
  if (!ready || !data) return <PageSpinner />;
  const { portfolio: p, txs, orders } = data;
  const openOrders = orders.filter((o) => OPEN_ORDER.has(o.status));
  const cityTotal = p.allocationByCity.reduce((a, c) => a + BigInt(c.amount), 0n);

  return (
    <div className="container-page pb-24 pt-10">
      <h1 className="font-display text-4xl text-ink">{d.title}</h1>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 border-y border-line py-8 lg:grid-cols-4">
        {[
          { label: d.invested, value: f.yen(p.totals.investedAmount) },
          { label: d.value, value: f.yen(p.totals.estimatedValue), note: d.valueNote },
          { label: d.received, value: f.yen(p.totals.distributionsReceived) },
          { label: d.projected, value: f.yen(p.totals.projectedAnnualDistribution), note: d.projectedNote },
        ].map((k) => (
          <div key={k.label} className="border-l-2 border-ink pl-4">
            <dd className="num font-display text-2xl text-ink sm:text-[1.75rem]">{k.value}</dd>
            <dt className="mt-1 text-sm text-ink-2">{k.label}</dt>
            {k.note && <p className="mt-1 text-xs leading-snug text-ink-3">{k.note}</p>}
          </div>
        ))}
      </dl>

      {openOrders.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-medium text-ink">{d.orders}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {openOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="text-ink">{o.property.name}</span>
                <span className="num text-ink-2">{f.yen(o.totalAmount)}</span>
                <Badge tone="warning">{d.orderStatus[o.status] ?? o.status}</Badge>
                <Link href={`/invest/${o.property.slug}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu">
                  {d.open}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.holdings.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-14 text-center">
          <h2 className="font-display text-xl text-ink">{d.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">{d.emptyBody}</p>
          <Link href="/properties" className={`${buttonVariants({ variant: 'ink' })} mt-6`}>
            {d.emptyCta}
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_16rem]">
          <section>
            <h2 className="text-lg font-medium text-ink">{d.holdings}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-3">
                    <th scope="col" className="py-2 font-normal">{d.property}</th>
                    <th scope="col" className="py-2 text-right font-normal">{d.tokens}</th>
                    <th scope="col" className="py-2 text-right font-normal">{d.share}</th>
                    <th scope="col" className="py-2 text-right font-normal">{d.investedCol}</th>
                    <th scope="col" className="py-2 text-right font-normal">{d.receivedCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.holdings.map((h) => (
                    <tr key={h.offeringId} className="border-b border-line">
                      <td className="py-3">
                        <Link href={`/properties/${h.property.slug}`} className="text-ink hover:underline">
                          {h.property.name}
                        </Link>
                        <span className="block text-xs text-ink-3">
                          {t.cities[h.property.city] ?? h.property.city} — {h.tokenSymbol}
                          {h.property.isDemo && ' — DEMO'}
                        </span>
                      </td>
                      <td className="num py-3 text-right text-ink">{f.int(h.tokens)}</td>
                      <td className="num py-3 text-right text-ink">{f.ppm(h.ownershipPpm)}</td>
                      <td className="num py-3 text-right text-ink">{f.yen(h.investedAmount)}</td>
                      <td className="num py-3 text-right text-ink">{f.yen(h.distributionsReceived)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-medium text-ink">{d.byCity}</h2>
            <ul className="mt-4 space-y-3">
              {p.allocationByCity.map((c) => {
                const pct = cityTotal > 0n ? Number((BigInt(c.amount) * 10_000n) / cityTotal) / 100 : 0;
                return (
                  <li key={c.city} className="text-sm">
                    <div className="flex justify-between text-ink-2">
                      <span>{t.cities[c.city] ?? c.city}</span>
                      <span className="num">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-washi-deep">
                      <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      <section className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-ink">{d.transactions}</h2>
          {txs.length > 0 && (
            <a href="/api/v1/me/transactions?format=csv" className={buttonVariants({ variant: 'outline', size: 'sm' })} download>
              {d.downloadCsv}
            </a>
          )}
        </div>
        {txs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">{d.noTransactions}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th scope="col" className="py-2 font-normal">{d.date}</th>
                  <th scope="col" className="py-2 font-normal">{d.type}</th>
                  <th scope="col" className="py-2 font-normal">{d.ref}</th>
                  <th scope="col" className="py-2 text-right font-normal">{d.tokens}</th>
                  <th scope="col" className="py-2 text-right font-normal">{d.amount}</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((x) => (
                  <tr key={`${x.type}-${x.reference}`} className="border-b border-line">
                    <td className="py-2.5 text-ink-2">{f.date(x.occurredAt)}</td>
                    <td className={cn('py-2.5', x.type === 'REFUND' ? 'text-kincha' : 'text-ink')}>{d.txTypes[x.type] ?? x.type}</td>
                    <td className="num py-2.5 text-ink-2">{x.reference}</td>
                    <td className="num py-2.5 text-right text-ink">{x.tokens ? f.int(x.tokens) : ''}</td>
                    <td className="num py-2.5 text-right text-ink">{x.amount ? f.yen(x.amount) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
