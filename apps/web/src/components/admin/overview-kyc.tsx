'use client';

import type { AdminOverviewDto } from '@jpt/shared';
import { Badge, Button, Select } from '@jpt/ui';
import { useState } from 'react';
import { Notice } from '@/components/app/ui';
import { useI18n } from '@/i18n/provider';
import { api } from '@/lib/client-api';
import { LoadState, ReasonForm, Stat, Table, td, useAction, useAdminData, useAdminError, useHasPermission } from './shell';

export function AdminOverview() {
  const { t, f } = useI18n();
  const o = t.admin.overview;
  const can = useHasPermission();
  const { data, error, loading, reload } = useAdminData<AdminOverviewDto>('/admin/overview');
  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const kycHref = can('kyc:review') ? '/admin/kyc' : undefined;
  const distHref = can('distribution:prepare') ? '/admin/distributions' : undefined;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label={o.users} value={f.int(data.users.total)} href={can('user:read') ? '/admin/users' : undefined} />
      <Stat label={o.staff} value={f.int(data.users.staff)} />
      <Stat label={o.verifiedInvestors} value={f.int(data.users.verifiedInvestors)} />
      <Stat label={o.raised} value={f.yen(data.raised)} />
      <Stat label={o.kycPending} value={f.int(data.kyc.pending)} href={kycHref} />
      <Stat label={o.kycReview} value={f.int(data.kyc.underReview)} href={kycHref} />
      <Stat label={o.awaitingPayment} value={f.int(data.orders.awaitingPayment)} />
      <Stat label={o.allocated} value={f.int(data.orders.allocated)} />
      <Stat label={o.refunded} value={f.int(data.orders.refunded)} />
      <Stat label={o.toApprove} value={f.int(data.distributions.awaitingApproval)} href={distHref} />
      <Stat label={o.toPay} value={f.int(data.distributions.awaitingPayment)} href={distHref} />
      <Stat label={o.auditEntries} value={f.int(data.audit.entries)} href={can('audit:read') ? '/admin/audit' : undefined} />
    </div>
  );
}

interface KycCase {
  id: string;
  email: string;
  countryOfResidence: string | null;
  isEntity: boolean;
  status: string;
  riskScore: number | null;
  pepMatch: boolean;
  sanctionsMatch: boolean;
  submittedAt: string | null;
  checks: Array<{ type: string; result: string }>;
}

const KYC_FILTERS = ['UNDER_REVIEW', 'PENDING', 'APPROVED', 'REJECTED'] as const;

export function AdminKyc() {
  const { t, f } = useI18n();
  const k = t.admin.kyc;
  const c = t.admin.common;
  const [status, setStatus] = useState<(typeof KYC_FILTERS)[number]>('UNDER_REVIEW');
  const { data, error, loading, reload } = useAdminData<KycCase[]>(`/compliance/kyc?status=${status}`);
  const [deciding, setDeciding] = useState<{ id: string; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction(reload);
  const errorText = useAdminError();

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-3 text-sm text-ink-2">
        {k.statusFilter}
        <Select value={status} onChange={(e) => setStatus(e.target.value as (typeof KYC_FILTERS)[number])} className="w-56">
          {KYC_FILTERS.map((s) => (
            <option key={s} value={s}>
              {k.statuses[s]}
            </option>
          ))}
        </Select>
      </label>
      {notice && <Notice tone="success">{notice}</Notice>}
      {action.error ? <Notice tone="error">{errorText(action.error)}</Notice> : null}
      {!data ? (
        <LoadState loading={loading} error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <p className="text-sm text-ink-3">{c.empty}</p>
      ) : (
        <Table head={[c.email, k.country, k.risk, k.checks, k.submitted, c.actions]} minWidth="52rem">
          {data.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className={td}>
                <span className="break-all">{r.email}</span>
                <span className="mt-0.5 block text-xs text-ink-3">{r.isEntity ? k.entity : k.person}</span>
              </td>
              <td className={td}>{r.countryOfResidence ?? '—'}</td>
              <td className={td}>
                <span className="num">{r.riskScore ?? '—'}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {r.pepMatch && <Badge tone="warning">{k.pep}</Badge>}
                  {r.sanctionsMatch && <Badge tone="open">{k.sanctions}</Badge>}
                </span>
              </td>
              <td className={td}>
                <ul className="space-y-0.5 text-xs">
                  {r.checks.map((ch) => (
                    <li key={ch.type}>
                      <span className="text-ink-3">{ch.type}</span> · {ch.result}
                    </li>
                  ))}
                </ul>
              </td>
              <td className={td}>{r.submittedAt ? f.date(r.submittedAt) : '—'}</td>
              <td className={td}>
                {r.status === 'UNDER_REVIEW' && deciding?.id !== r.id && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setDeciding({ id: r.id, decision: 'APPROVE' })}>
                      {k.approve}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeciding({ id: r.id, decision: 'REJECT' })}>
                      {k.reject}
                    </Button>
                  </div>
                )}
                {r.status !== 'UNDER_REVIEW' && <Badge>{k.statuses[r.status] ?? r.status}</Badge>}
                {deciding?.id === r.id && (
                  <ReasonForm
                    label={c.reason}
                    confirmLabel={deciding.decision === 'APPROVE' ? k.approve : k.reject}
                    tone={deciding.decision === 'APPROVE' ? 'ink' : 'shu'}
                    pending={action.pending}
                    onCancel={() => setDeciding(null)}
                    onSubmit={async (reason) => {
                      setNotice(null);
                      const ok = await action.run(() =>
                        api(`/compliance/kyc/${r.id}/decision`, { body: { decision: deciding.decision, reason } }),
                      );
                      if (ok) {
                        setDeciding(null);
                        setNotice(k.decided);
                      }
                    }}
                  />
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
