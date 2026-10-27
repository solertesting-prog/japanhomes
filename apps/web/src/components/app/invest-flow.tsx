'use client';

import { type PropertyDetailDto, simulateInvestment } from '@jpt/shared';
import { Button, buttonVariants, Checkbox, cn, IconChevronLeft, Input } from '@jpt/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, DEV_TOOLS, newIdempotencyKey } from '@/lib/client-api';
import { financialsFromDto } from '@/lib/financials';
import { useRequireSession } from '@/lib/session';
import { Notice, PageSpinner, Steps, useErrorText } from './ui';

export interface OrderDto {
  id: string;
  reference: string;
  status: string;
  isSimulated: boolean;
  property: { slug: string; name: string };
  tokenSymbol: string;
  tokens: string;
  tokenPrice: string;
  amount: string;
  feeAmount: string;
  totalAmount: string;
  expiresAt: string | null;
  createdAt: string;
  requiredDocuments: Array<{ id: string; type: string; title: string; sha256: string; accepted: boolean }>;
  payment: { id: string; status: string; instructions: { method: string; reference: string; amount: string; note: string } | null } | null;
  allocation: { status: string; tokens: string; note: string } | null;
}

const TERMINAL = new Set(['CANCELLED', 'EXPIRED', 'REFUNDED', 'REFUND_PENDING', 'REJECTED']);
const storageKey = (slug: string) => `jpt:order:${slug}`;

function stepOf(order: OrderDto | null): number {
  if (!order) return 0;
  if (order.status === 'PENDING_DOCUMENTS') return 1;
  if (order.status === 'ALLOCATED') return 3;
  return 2;
}

export function InvestFlow({ property: p }: { property: PropertyDetailDto }) {
  const { t, f } = useI18n();
  const v = t.app.invest;
  const errText = useErrorText();
  const { ready } = useRequireSession({ verified: true });
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const remember = useCallback(
    (o: OrderDto | null) => {
      setOrder(o);
      try {
        if (o && !TERMINAL.has(o.status) && o.status !== 'ALLOCATED') sessionStorage.setItem(storageKey(p.slug), o.id);
        else sessionStorage.removeItem(storageKey(p.slug));
      } catch {
        /* storage unavailable: the flow still works, it just won't resume after reload */
      }
    },
    [p.slug],
  );

  // Resume an open order after a reload.
  useEffect(() => {
    if (!ready) return;
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(storageKey(p.slug));
    } catch {
      id = null;
    }
    if (!id) return setRestoring(false);
    api<OrderDto>(`/subscriptions/${id}`)
      .then((o) => setOrder(o))
      .catch(() => remember(null))
      .finally(() => setRestoring(false));
  }, [ready, p.slug, remember]);

  // While waiting for the provider, poll the order.
  useEffect(() => {
    if (!order || order.status !== 'AWAITING_PAYMENT') return;
    const id = setInterval(async () => {
      try {
        remember(await api<OrderDto>(`/subscriptions/${order.id}`));
      } catch {
        /* transient: try again on the next tick */
      }
    }, 3_000);
    return () => clearInterval(id);
  }, [order, remember]);

  const run = async (fn: () => Promise<OrderDto>) => {
    setBusy(true);
    setError(null);
    try {
      remember(await fn());
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!ready || restoring) return <PageSpinner />;

  return (
    <div className="container-page max-w-3xl pb-24 pt-8">
      <Link href={`/properties/${p.slug}`} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <IconChevronLeft size={16} /> {p.name}
      </Link>
      <h1 className="mt-5 font-display text-3xl text-ink sm:text-4xl">{v.title(p.name)}</h1>
      {p.isDemo && <p className="mt-2 text-sm text-ink-2">{v.simulated}</p>}
      <div className="mt-8">
        <Steps steps={v.steps} current={stepOf(order)} />
      </div>

      {error && <div className="mt-6"><Notice tone="error">{error}</Notice></div>}

      <div className="mt-8">
        {!order && <AmountStep p={p} busy={busy} onReserve={(amount, key) => run(() => api<OrderDto>('/subscriptions', { body: { propertySlug: p.slug, amount }, idempotencyKey: key }))} />}

        {order && TERMINAL.has(order.status) && (
          <div className="space-y-5">
            <Notice>{order.status === 'CANCELLED' ? v.cancelled : order.status === 'EXPIRED' ? v.expired : v.refunded}</Notice>
            <Button variant="outline" onClick={() => remember(null)}>
              {v.reserve}
            </Button>
          </div>
        )}

        {order?.status === 'PENDING_DOCUMENTS' && (
          <DocumentsStep
            order={order}
            busy={busy}
            onAccept={(ids) => run(() => api<OrderDto>(`/subscriptions/${order.id}/accept-documents`, { body: { documentIds: ids } }))}
            onCancel={() => run(() => api<OrderDto>(`/subscriptions/${order.id}/cancel`, { method: 'POST' }))}
          />
        )}

        {order && ['AWAITING_PAYMENT', 'PAYMENT_RECEIVED', 'COMPLIANCE_CHECK', 'ALLOCATING'].includes(order.status) && (
          <PaymentStep
            order={order}
            busy={busy}
            onSimulate={(outcome) =>
              run(async () => {
                await api(`/dev/payments/${order.id}/simulate`, { body: { outcome } });
                return api<OrderDto>(`/subscriptions/${order.id}`);
              })
            }
            onCancel={() => run(() => api<OrderDto>(`/subscriptions/${order.id}/cancel`, { method: 'POST' }))}
          />
        )}

        {order?.status === 'ALLOCATED' && (
          <div className="rounded-[var(--radius-card)] border border-matcha/40 bg-matcha-tint p-6">
            <h2 className="font-display text-2xl text-ink">{v.doneTitle}</h2>
            <p className="mt-2 text-ink-2">{v.doneBody(f.int(order.tokens), p.name)}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Fact label={v.reference} value={order.reference} />
              <Fact label={v.tokens} value={f.int(order.tokens)} />
              <Fact label={v.fee} value={f.yen(order.feeAmount)} />
              <Fact label={v.total} value={f.yen(order.totalAmount)} />
            </dl>
            <p className="mt-5 text-xs text-ink-3">{v.allocationNote} {v.receiptSent}</p>
            <Link href="/dashboard" className={`${buttonVariants({ variant: 'ink' })} mt-6`}>
              {v.toDashboard}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="num mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}

function AmountStep({ p, busy, onReserve }: { p: PropertyDetailDto; busy: boolean; onReserve: (amount: string, key: string) => void }) {
  const { t, f } = useI18n();
  const v = t.app.invest;
  const [raw, setRaw] = useState(p.minimumInvestment);
  // One key per attempt: retries of the same click never create two orders.
  const [key] = useState(newIdempotencyKey);
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  const sim = useMemo(
    () =>
      simulateInvestment({
        financials: financialsFromDto(p),
        tokensSold: BigInt(p.token.tokensSold),
        amount: BigInt(digits || '0'),
        minimumInvestment: BigInt(p.minimumInvestment),
        maximumInvestment: p.maximumInvestment === null ? null : BigInt(p.maximumInvestment),
      }),
    [p, digits],
  );
  return (
    <div className="space-y-6">
      <p className="text-ink-2">{v.amountLede}</p>
      <label className="block max-w-sm">
        <span className="text-sm font-medium text-ink">{v.amount}</span>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">¥</span>
          <Input inputMode="numeric" value={digits ? f.int(digits) : ''} onChange={(e) => setRaw(e.target.value)} className="num h-12 pl-8 text-lg" />
        </div>
      </label>
      <dl className="grid max-w-xl grid-cols-2 gap-4 rounded-[var(--radius-card)] border border-line p-5 text-sm sm:grid-cols-4">
        <Fact label={v.tokens} value={f.int(sim.tokens)} />
        <Fact label={v.amount} value={f.yen(sim.investedAmount)} />
        <Fact label={v.fee} value={f.yen(sim.subscriptionFee)} />
        <Fact label={v.total} value={f.yen(sim.totalPayable)} />
      </dl>
      {sim.issues.includes('BELOW_MINIMUM') && <Notice tone="error">{t.simulator.issues.BELOW_MINIMUM(f.yen(p.minimumInvestment))}</Notice>}
      {sim.issues.includes('ABOVE_MAXIMUM') && <Notice tone="error">{t.simulator.issues.ABOVE_MAXIMUM(f.yen(p.maximumInvestment ?? '0'))}</Notice>}
      {sim.issues.includes('EXCEEDS_AVAILABLE') && <Notice tone="error">{t.simulator.issues.EXCEEDS_AVAILABLE(f.int(sim.tokensAvailable))}</Notice>}
      <Button variant="shu" size="lg" disabled={busy || !sim.eligibleAmount} onClick={() => onReserve(digits, key)}>
        {busy ? v.reserving : v.reserve}
      </Button>
    </div>
  );
}

function DocumentsStep({ order, busy, onAccept, onCancel }: { order: OrderDto; busy: boolean; onAccept: (ids: string[]) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const v = t.app.invest;
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const all = order.requiredDocuments.length > 0 && order.requiredDocuments.every((d) => checked.has(d.id));
  return (
    <div className="space-y-6">
      <Notice>{v.reservedFor(30)}</Notice>
      <p className="text-ink-2">{v.docsLede}</p>
      <ul className="divide-y divide-line border-y border-line">
        {order.requiredDocuments.map((d) => (
          <li key={d.id} className="py-4">
            <p className="font-medium text-ink">{d.title}</p>
            <p className="num mt-0.5 text-xs text-ink-3">
              {v.version}: {d.sha256.slice(0, 16)}…
            </p>
            <label className="mt-3 flex items-center gap-2.5 text-sm text-ink-2">
              <Checkbox
                checked={checked.has(d.id)}
                onChange={(e) => {
                  const next = new Set(checked);
                  if (e.target.checked) next.add(d.id);
                  else next.delete(d.id);
                  setChecked(next);
                }}
              />
              {v.docAccept}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy || !all} onClick={() => onAccept([...checked])}>
          {v.acceptContinue}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          {v.cancel}
        </Button>
      </div>
    </div>
  );
}

function PaymentStep({ order, busy, onSimulate, onCancel }: { order: OrderDto; busy: boolean; onSimulate: (o: 'succeeded' | 'failed') => void; onCancel: () => void }) {
  const { t, f, locale } = useI18n();
  const v = t.app.invest;
  const i = order.payment?.instructions;
  const expires = order.expiresAt
    ? new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : locale === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(order.expiresAt))
    : null;
  const failed = order.payment?.status === 'FAILED';
  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-line p-6">
        <h2 className="text-lg font-medium text-ink">{v.payTitle}</h2>
        <p className="mt-1 text-sm text-ink-2">{v.payLede}</p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <Fact label={v.reference} value={i?.reference ?? order.reference} />
          <Fact label={v.total} value={f.yen(order.totalAmount)} />
          <Fact label={v.method} value={i?.method.replace(/_/g, ' ').toLowerCase() ?? '—'} />
        </dl>
        {i?.note && <p className="mt-4 text-xs text-ink-3">{i.note}</p>}
        {expires && order.status === 'AWAITING_PAYMENT' && <p className="mt-2 text-xs text-ink-3">{v.expires(expires)}</p>}
      </div>
      {failed ? <Notice tone="error">{v.failed}</Notice> : <p className={cn('text-sm text-ink-2', order.status === 'AWAITING_PAYMENT' && 'animate-pulse')}>{v.waiting}</p>}
      {DEV_TOOLS && order.status === 'AWAITING_PAYMENT' && (
        <div className="rounded-lg border border-dashed border-line-strong p-5">
          <p className="text-xs text-ink-3">{v.devPay}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => onSimulate('succeeded')}>{v.devSucceed}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onSimulate('failed')}>{v.devFail}</Button>
          </div>
        </div>
      )}
      {order.status === 'AWAITING_PAYMENT' && (
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          {v.cancel}
        </Button>
      )}
    </div>
  );
}
