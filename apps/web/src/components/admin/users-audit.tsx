'use client';

import { type AuditEntryDto, type AuditVerifyDto, STAFF_ROLES } from '@jpt/shared';
import { Badge, Button, Input, Select } from '@jpt/ui';
import { useState } from 'react';
import { Notice } from '@/components/app/ui';
import { useI18n } from '@/i18n/provider';
import { api } from '@/lib/client-api';
import { useSession } from '@/lib/session';
import { LoadState, Table, td, useAction, useAdminData, useAdminError, useHasPermission } from './shell';

interface AdminUserRow {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  kycStatus: string;
  countryOfResidence: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

const PAGE = 25;

export function AdminUsers() {
  const { t, f } = useI18n();
  const u = t.admin.users;
  const c = t.admin.common;
  const can = useHasPermission();
  const { me } = useSession();
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const path = `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page) })}`;
  const { data, error, loading, reload } = useAdminData<{ total: number; items: AdminUserRow[] }>(path);
  const action = useAction(reload);
  const errorText = useAdminError();
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div className="space-y-5">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(draft.trim());
        }}
      >
        <Input type="search" placeholder={u.search} aria-label={u.search} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" variant="outline">
          {t.admin.audit.filter}
        </Button>
      </form>
      {action.error ? <Notice tone="error">{errorText(action.error)}</Notice> : null}
      {!data ? (
        <LoadState loading={loading} error={error} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <p className="text-sm text-ink-3">{c.empty}</p>
      ) : (
        <>
          <Table head={[c.email, c.status, u.kyc, u.mfa, u.roles, u.lastLogin, c.actions]} minWidth="60rem">
            {data.items.map((row) => {
              const self = row.id === me?.id;
              const staffRoles = row.roles.filter((r) => (STAFF_ROLES as readonly string[]).includes(r));
              const grantable = STAFF_ROLES.filter((r) => !row.roles.includes(r));
              return (
                <tr key={row.id} className="border-b border-line">
                  <td className={`${td} break-all`}>
                    {row.email}
                    {self && <span className="ml-1 text-xs text-ink-3">({u.you})</span>}
                    <span className="block text-xs text-ink-3">{row.countryOfResidence ?? ''}</span>
                  </td>
                  <td className={td}>
                    <Badge tone={row.status === 'ACTIVE' ? 'funded' : row.status === 'SUSPENDED' ? 'open' : 'neutral'}>
                      {u.statuses[row.status] ?? row.status}
                    </Badge>
                  </td>
                  <td className={td}>{t.admin.kyc.statuses[row.kycStatus] ?? row.kycStatus}</td>
                  <td className={td}>{row.mfaEnabled ? '✓' : '—'}</td>
                  <td className={td}>
                    <ul className="space-y-1">
                      {staffRoles.map((r) => (
                        <li key={r} className="flex items-center gap-2 text-xs">
                          <span className="num">{r}</span>
                          {can('role:assign') && !self && (
                            <button
                              type="button"
                              disabled={action.pending}
                              className="text-shu-deep underline underline-offset-2 disabled:opacity-50"
                              onClick={() => action.run(() => api(`/admin/users/${row.id}/roles`, { body: { role: r, grant: false } }))}
                            >
                              {u.revoke}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {can('role:assign') && !self && grantable.length > 0 && (
                      <Select
                        className="mt-1 h-8 w-48 text-xs"
                        value=""
                        aria-label={u.grant}
                        disabled={action.pending}
                        onChange={(e) => {
                          const role = e.target.value;
                          if (role) void action.run(() => api(`/admin/users/${row.id}/roles`, { body: { role, grant: true } }));
                        }}
                      >
                        <option value="">{u.grant}</option>
                        {grantable.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    )}
                  </td>
                  <td className={td}>{row.lastLoginAt ? f.date(row.lastLoginAt) : '—'}</td>
                  <td className={td}>
                    {can('user:block') && !self && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={action.pending}
                        onClick={() => action.run(() => api(`/admin/users/${row.id}/${row.status === 'SUSPENDED' ? 'unblock' : 'block'}`, { method: 'POST' }))}
                      >
                        {row.status === 'SUSPENDED' ? u.unblock : u.block}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pager page={page} pages={pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const { t } = useI18n();
  const c = t.admin.common;
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {c.prev}
      </Button>
      <span className="num text-ink-3">
        {c.page.replace('{n}', String(page))} / {pages}
      </span>
      <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {c.next}
      </Button>
    </div>
  );
}

function compact(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}

export function AdminAudit() {
  const { t, f } = useI18n();
  const a = t.admin.audit;
  const [draft, setDraft] = useState({ action: '', entityType: '' });
  const [filter, setFilter] = useState({ action: '', entityType: '' });
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (filter.action) params.set('action', filter.action);
  if (filter.entityType) params.set('entityType', filter.entityType);
  const { data, error, loading, reload } = useAdminData<{ total: number; items: AuditEntryDto[] }>(`/admin/audit?${params}`);
  const [verify, setVerify] = useState<AuditVerifyDto | null>(null);
  const verifyAction = useAction();
  const errorText = useAdminError();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setFilter({ action: draft.action.trim(), entityType: draft.entityType.trim() });
          }}
        >
          <label className="text-xs text-ink-3">
            {a.filterAction}
            <Input className="mt-1 h-9 w-48" placeholder="kyc." value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
          </label>
          <label className="text-xs text-ink-3">
            {a.filterEntity}
            <Input className="mt-1 h-9 w-48" placeholder="Distribution" value={draft.entityType} onChange={(e) => setDraft({ ...draft, entityType: e.target.value })} />
          </label>
          <Button type="submit" size="sm" variant="outline">
            {a.filter}
          </Button>
        </form>
        <Button
          size="sm"
          disabled={verifyAction.pending}
          onClick={() =>
            verifyAction.run(async () => {
              setVerify(await api<AuditVerifyDto>('/admin/audit/verify'));
            })
          }
        >
          {a.verify}
        </Button>
      </div>
      {verify && (
        <Notice tone={verify.ok ? 'success' : 'error'}>
          {verify.ok
            ? a.verifyOk.replace('{n}', f.int(verify.checked))
            : a.verifyBroken.replace('{id}', verify.firstBrokenId ?? '?').replace('{reason}', verify.reason ?? '')}
        </Notice>
      )}
      {verifyAction.error ? <Notice tone="error">{errorText(verifyAction.error)}</Notice> : null}
      {!data ? (
        <LoadState loading={loading} error={error} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <p className="text-sm text-ink-3">{t.admin.common.empty}</p>
      ) : (
        <>
          <Table head={['#', t.admin.common.date, a.actor, a.action, a.entity, a.changes]} minWidth="64rem">
            {data.items.map((e) => (
              <tr key={e.id} className="border-b border-line">
                <td className={`${td} num text-ink-3`}>{e.id}</td>
                <td className={`${td} whitespace-nowrap`}>
                  {f.date(e.occurredAt)}
                  <span className="num block text-xs text-ink-3">{new Date(e.occurredAt).toISOString().slice(11, 19)} UTC</span>
                </td>
                <td className={`${td} break-all`}>{e.actorEmail ?? (e.actorType === 'WEBHOOK' ? a.webhook : a.system)}</td>
                <td className={`${td} num`}>{e.action}</td>
                <td className={td}>
                  {e.entityType}
                  <span className="num block text-xs text-ink-3">{e.entityId.slice(0, 8)}</span>
                </td>
                <td className={`${td} max-w-[22rem]`}>
                  {e.before !== null && e.before !== undefined && (
                    <code className="block break-all text-xs text-ink-3 line-through decoration-line-strong">{compact(e.before)}</code>
                  )}
                  <code className="block break-all text-xs text-ink-2">{compact(e.after)}</code>
                </td>
              </tr>
            ))}
          </Table>
          <Pager page={page} pages={Math.max(1, Math.ceil(data.total / 50))} onPage={setPage} />
        </>
      )}
    </div>
  );
}
