'use client';

import type { AdminPropertyDto, DistributionDetailDto, DistributionStatusKey, DistributionSummaryDto } from '@jpt/shared';
import { Badge, Button, Select } from '@jpt/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Field, Notice } from '@/components/app/ui';
import { useI18n } from '@/i18n/provider';
import { api } from '@/lib/client-api';
import { useSession } from '@/lib/session';
import { LoadState, ReasonForm, Table, td, tdNum, useAction, useAdminData, useAdminError, useHasPermission } from './shell';

const STATUS_TONE: Record<DistributionStatusKey, 'neutral' | 'warning' | 'soon' | 'funded' | 'closed'> = {
  DRAFT: 'neutral',
  CALCULATED: 'warning',
  APPROVED: 'soon',
  PAYING: 'soon',
  PAID: 'funded',
  CANCELLED: 'closed',
};

const OPERATING = new Set(['OPEN', 'FUNDED', 'CLOSED']);

interface Preview {
  grossIncome: string;
  operatingExpenses: string;
  taxes: string;
  fees: string;
  reserveAllocation: string;
  distributableAmount: string;
}

/** Last full calendar month, as the default period. */
function lastMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function AdminDistributions() {
  const { t, f } = useI18n();
  const d = t.admin.distributions;
  const { data, error, loading, reload } = useAdminData<DistributionSummaryDto[]>('/admin/distributions');
  return (
    <div className="space-y-10">
      <NewDistribution />
      <section>
        <h2 className="mb-3 font-display text-xl text-ink">{t.admin.nav.distributions}</h2>
        {!data ? (
          <LoadState loading={loading} error={error} onRetry={reload} />
        ) : data.length === 0 ? (
          <p className="text-sm text-ink-3">{t.admin.common.empty}</p>
        ) : (
          <Table head={[d.offering, d.period, d.distributable, d.holders, t.admin.common.status, '']} minWidth="46rem">
            {data.map((x) => (
              <tr key={x.id} className="border-b border-line">
                <td className={td}>
                  <span className="num font-medium">{x.tokenSymbol}</span>
                  <span className="block text-xs text-ink-3">{x.propertyName}</span>
                </td>
                <td className={td}>
                  {f.date(`${x.periodStart}T00:00:00Z`)} – {f.date(`${x.periodEnd}T00:00:00Z`)}
                </td>
                <td className={tdNum}>{f.yen(x.distributableAmount)}</td>
                <td className={tdNum}>{f.int(x.holders)}</td>
                <td className={td}>
                  <Badge tone={STATUS_TONE[x.status]}>{d.statuses[x.status]}</Badge>
                  {x.isDemo && (
                    <Badge tone="demo" className="ml-1">
                      DEMO
                    </Badge>
                  )}
                </td>
                <td className={td}>
                  <Link href={`/admin/distributions/${x.id}`} className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu">
                    {d.open}
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}

function NewDistribution() {
  const { t, f } = useI18n();
  const d = t.admin.distributions;
  const router = useRouter();
  const errorText = useAdminError();
  const props = useAdminData<AdminPropertyDto[]>('/admin/properties');
  const offerings = useMemo(
    () =>
      (props.data ?? []).flatMap((p) =>
        p.offerings.filter((o) => OPERATING.has(o.status)).map((o) => ({ id: o.id, label: `${o.tokenSymbol} · ${p.name}` })),
      ),
    [props.data],
  );
  const period = useMemo(lastMonth, []);
  const [form, setForm] = useState({ offeringId: '', periodStart: period.start, periodEnd: period.end, reserve: '0', paymentDate: '' });
  const offeringId = form.offeringId || offerings[0]?.id || '';
  const valid = !!offeringId && !!form.periodStart && !!form.periodEnd && /^\d{1,15}$/.test(form.reserve);
  const previewPath = valid
    ? `/admin/distributions/preview?${new URLSearchParams({
        offeringId,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        reserveAllocation: form.reserve,
      })}`
    : null;
  const preview = useAdminData<Preview>(previewPath);
  const action = useAction();

  if (!props.data) return <LoadState loading={props.loading} error={props.error} onRetry={props.reload} />;
  if (offerings.length === 0) return <Notice>{d.noOfferings}</Notice>;

  const p = preview.data;
  const negative = p ? BigInt(p.distributableAmount) < 0n : false;

  return (
    <section className="rounded-lg border border-line p-4 md:p-5">
      <h2 className="font-display text-xl text-ink">{d.new}</h2>
      <form
        className="mt-4 grid gap-6 lg:grid-cols-[1fr_1fr]"
        onSubmit={async (e) => {
          e.preventDefault();
          let created: DistributionDetailDto | undefined;
          const ok = await action.run(async () => {
            created = await api<DistributionDetailDto>('/admin/distributions', {
              body: {
                offeringId,
                periodStart: form.periodStart,
                periodEnd: form.periodEnd,
                reserveAllocation: form.reserve,
                ...(form.paymentDate ? { paymentDate: form.paymentDate } : {}),
              },
            });
          });
          if (ok && created) router.push(`/admin/distributions/${created.id}`);
        }}
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium text-ink">
            {d.offering}
            <Select className="mt-1.5" value={offeringId} onChange={(e) => setForm({ ...form, offeringId: e.target.value })}>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label={d.periodStart} type="date" required value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
            <Field label={d.periodEnd} type="date" required value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
          </div>
          <Field label={d.reserve} inputMode="numeric" value={form.reserve} onChange={(e) => setForm({ ...form, reserve: e.target.value.replace(/\D/g, '') || '0' })} />
          <Field label={d.paymentDate} type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">{d.preview}</p>
          {preview.error ? (
            <div className="mt-2">
              <Notice tone="error">{errorText(preview.error)}</Notice>
            </div>
          ) : p ? (
            <dl className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
              <Line label={d.gross} value={f.yen(p.grossIncome)} />
              <Line label={d.opex} value={`− ${f.yen(p.operatingExpenses)}`} />
              <Line label={d.taxes} value={`− ${f.yen(p.taxes)}`} />
              <Line label={d.fees} value={`− ${f.yen(p.fees)}`} />
              <Line label={d.reserveLine} value={`− ${f.yen(p.reserveAllocation)}`} />
              <Line label={d.distributable} value={f.yen(p.distributableAmount)} strong />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-ink-3">{t.admin.common.loading}</p>
          )}
          {action.error ? (
            <div className="mt-3">
              <Notice tone="error">{errorText(action.error)}</Notice>
            </div>
          ) : null}
          <Button type="submit" className="mt-4" disabled={!valid || action.pending || negative || !p || BigInt(p.grossIncome) === 0n}>
            {d.calculate}
          </Button>
          <p className="mt-2 text-xs text-ink-3">{d.withholdingNote}</p>
        </div>
      </form>
    </section>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
      <dt className={strong ? 'font-medium text-ink' : 'text-ink-2'}>{label}</dt>
      <dd className={`num ${strong ? 'font-medium text-ink' : 'text-ink-2'}`}>{value}</dd>
    </div>
  );
}

export function AdminDistributionDetail({ id }: { id: string }) {
  const { t, f } = useI18n();
  const d = t.admin.distributions;
  const can = useHasPermission();
  const { me } = useSession();
  const { data, error, loading, reload } = useAdminData<DistributionDetailDto>(`/admin/distributions/${id}`);
  const action = useAction(reload);
  const errorText = useAdminError();
  const [cancelling, setCancelling] = useState(false);

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const seeded = data.status === 'PAID' && data.holders === 0 && !data.preparedBy;
  const iPrepared = !!me && data.preparedBy === me.email;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/distributions" className="text-sm text-ink-3 hover:text-ink">
          ← {t.admin.common.back}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl text-ink">
            {data.tokenSymbol} · {f.date(`${data.periodStart}T00:00:00Z`)} – {f.date(`${data.periodEnd}T00:00:00Z`)}
          </h2>
          <Badge tone={STATUS_TONE[data.status]}>{d.statuses[data.status]}</Badge>
          {data.isDemo && <Badge tone="demo">DEMO</Badge>}
        </div>
        <p className="mt-1 text-sm text-ink-3">{data.propertyName}</p>
      </div>

      {seeded && <Notice>{d.seeded}</Notice>}

      <div className="grid gap-6 lg:grid-cols-2">
        <dl className="divide-y divide-line rounded-lg border border-line text-sm">
          <Line label={d.gross} value={f.yen(data.grossIncome)} />
          <Line label={d.opex} value={`− ${f.yen(data.operatingExpenses)}`} />
          <Line label={d.taxes} value={`− ${f.yen(data.taxes)}`} />
          <Line label={d.fees} value={`− ${f.yen(data.fees)}`} />
          <Line label={d.reserveLine} value={`− ${f.yen(data.reserveAllocation)}`} />
          <Line label={d.distributable} value={f.yen(data.distributableAmount)} strong />
          <Line label={d.allocated} value={f.yen(data.allocatedAmount)} />
          {data.unallocatedAmount !== '0' && <Line label={d.unallocated} value={f.yen(data.unallocatedAmount)} />}
        </dl>
        <dl className="divide-y divide-line rounded-lg border border-line text-sm">
          <Line label={d.recordDate} value={data.recordDate ? f.date(data.recordDate) : '—'} />
          <Line label={d.preparedBy} value={data.preparedBy ?? '—'} />
          <Line label={d.approvedBy} value={data.approvedBy ? `${data.approvedBy} · ${f.date(data.approvedAt!)}` : '—'} />
          <Line label={d.paidAt} value={data.paidAt ? f.date(data.paidAt) : '—'} />
          <Line label={d.holders} value={f.int(data.holders)} />
        </dl>
      </div>

      {(data.status === 'CALCULATED' || data.status === 'APPROVED' || data.status === 'PAYING') && (
        <div className="space-y-3">
          {data.status === 'CALCULATED' && <p className="text-sm text-ink-3">{d.fourEyesNote}</p>}
          <div className="flex flex-wrap gap-2">
            {data.status === 'CALCULATED' && can('distribution:approve') && (
              <Button disabled={action.pending || iPrepared} onClick={() => action.run(() => api(`/admin/distributions/${id}/approve`, { method: 'POST' }))}>
                {d.approve}
              </Button>
            )}
            {(data.status === 'APPROVED' || data.status === 'PAYING') && can('payment:approve') && (
              <Button variant="shu" disabled={action.pending} onClick={() => action.run(() => api(`/admin/distributions/${id}/pay`, { method: 'POST' }))}>
                {d.pay}
              </Button>
            )}
            {data.status !== 'PAYING' && can('distribution:prepare') && !cancelling && (
              <Button variant="outline" disabled={action.pending} onClick={() => setCancelling(true)}>
                {d.cancelDist}
              </Button>
            )}
          </div>
          {cancelling && (
            <ReasonForm
              label={t.admin.common.reason}
              confirmLabel={d.cancelDist}
              tone="shu"
              pending={action.pending}
              onCancel={() => setCancelling(false)}
              onSubmit={async (reason) => {
                if (await action.run(() => api(`/admin/distributions/${id}/cancel`, { body: { reason } }))) setCancelling(false);
              }}
            />
          )}
          {action.error ? <Notice tone="error">{errorText(action.error)}</Notice> : null}
        </div>
      )}

      {data.allocations.length > 0 && (
        <section>
          <Table head={[d.investor, d.tokens, d.grossCol, d.withholding, d.net, t.admin.common.status]} minWidth="48rem">
            {data.allocations.map((a) => (
              <tr key={a.id} className="border-b border-line">
                <td className={`${td} break-all`}>{a.email}</td>
                <td className={tdNum}>{f.int(a.tokensAtRecord)}</td>
                <td className={tdNum}>{f.yen(a.grossAmount)}</td>
                <td className={tdNum}>
                  {f.yen(a.withholdingTax)}
                  <span className="block text-xs text-ink-3">{f.pct(a.withholdingTaxBps)}</span>
                </td>
                <td className={tdNum}>{f.yen(a.netAmount)}</td>
                <td className={td}>
                  <Badge tone={a.status === 'PAID' ? 'funded' : a.status === 'FAILED' ? 'open' : 'neutral'}>{d.allocationStatus[a.status]}</Badge>
                  {a.holdReason && <span className="mt-1 block text-xs text-ink-3">{a.holdReason}</span>}
                </td>
              </tr>
            ))}
          </Table>
          <p className="mt-2 text-xs text-ink-3">{d.withholdingNote}</p>
        </section>
      )}
    </div>
  );
}
