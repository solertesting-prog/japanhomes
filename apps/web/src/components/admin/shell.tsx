'use client';

import { isStaff } from '@jpt/shared';
import { Button, buttonVariants, cn } from '@jpt/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Notice, PageSpinner } from '@/components/app/ui';
import { useI18n } from '@/i18n/provider';
import { api, ApiClientError } from '@/lib/client-api';
import { useRequireSession, useSession } from '@/lib/session';

/** Back-office sections and the permission each one needs (the API checks again). */
const SECTIONS = [
  { key: 'overview', href: '/admin', perm: null },
  { key: 'kyc', href: '/admin/kyc', perm: 'kyc:review' },
  { key: 'properties', href: '/admin/properties', perm: 'property:read' },
  { key: 'distributions', href: '/admin/distributions', perm: 'distribution:prepare' },
  { key: 'chain', href: '/admin/chain', perm: 'token:operate' },
  { key: 'users', href: '/admin/users', perm: 'user:read' },
  { key: 'audit', href: '/admin/audit', perm: 'audit:read' },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const a = t.admin;
  const { me, ready } = useRequireSession();
  const pathname = usePathname();

  if (!ready || !me) return <PageSpinner />;
  if (!isStaff(me.permissions)) {
    return (
      <div className="container-page py-20">
        <Notice tone="error">{a.gate.noAccess}</Notice>
      </div>
    );
  }
  if (!me.mfaEnabled) {
    return (
      <div className="container-page max-w-xl py-20">
        <Notice tone="error">{a.gate.needMfa}</Notice>
        <Link href="/account" className={cn(buttonVariants({ variant: 'ink' }), 'mt-6')}>
          {a.gate.enableMfa}
        </Link>
      </div>
    );
  }

  const perms = new Set(me.permissions);
  const visible = SECTIONS.filter((s) => !s.perm || perms.has(s.perm));
  const active = [...visible].reverse().find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));

  return (
    <div className="container-page py-8 md:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl text-ink md:text-3xl">{a.title}</h1>
        <p className="text-xs text-ink-3">{me.email}</p>
      </div>
      <p className="mt-1 text-sm text-ink-3">{a.demoNote}</p>
      <nav aria-label={a.title} className="-mx-1 mt-6 flex gap-1 overflow-x-auto border-b border-line pb-px">
        {visible.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            aria-current={active?.key === s.key ? 'page' : undefined}
            className="whitespace-nowrap rounded-t-md px-3 py-2.5 text-sm text-ink-2 hover:text-ink aria-[current=page]:border-b-2 aria-[current=page]:border-shu aria-[current=page]:font-medium aria-[current=page]:text-ink"
          >
            {a.nav[s.key]}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function useHasPermission() {
  const { me } = useSession();
  return (perm: string) => !!me?.permissions.includes(perm);
}

/** Maps back-office API errors to the visitor's language. */
export function useAdminError() {
  const { t } = useI18n();
  return (e: unknown): string => {
    if (e instanceof ApiClientError) return t.admin.errors[e.code] ?? t.app.errors[e.code] ?? e.message;
    return t.app.errors.generic!;
  };
}

/** GET with loading / error / reload. `path` null skips the request. */
export function useAdminData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (path === null) return;
    const ctrl = new AbortController();
    setLoading(true);
    api<T>(path, { signal: ctrl.signal })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [path, tick]);
  return { data, error, loading, reload };
}

export function LoadState({ loading, error, onRetry }: { loading: boolean; error: unknown; onRetry: () => void }) {
  const { t } = useI18n();
  const errorText = useAdminError();
  if (error) {
    return (
      <div className="space-y-3">
        <Notice tone="error">{errorText(error)}</Notice>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t.admin.common.retry}
        </Button>
      </div>
    );
  }
  if (loading) return <p className="text-sm text-ink-3">{t.admin.common.loading}</p>;
  return null;
}

/** Runs a mutation, tracks its pending state and error, then calls onDone. */
export function useAction(onDone?: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setPending(true);
      setError(null);
      try {
        await fn();
        onDone?.();
        return true;
      } catch (e) {
        setError(e);
        return false;
      } finally {
        setPending(false);
      }
    },
    [onDone],
  );
  return { pending, error, run, clearError: () => setError(null) };
}

export function Stat({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="num mt-1 font-display text-2xl text-ink">{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg border border-line p-4 transition-colors hover:border-ink">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-line p-4">{body}</div>
  );
}

export function Table({ head, children, minWidth = '40rem' }: { head: ReactNode[]; children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            {head.map((h, i) => (
              <th key={i} scope="col" className="py-2 pr-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const td = 'py-2.5 pr-3 align-top';
export const tdNum = 'num py-2.5 pr-3 text-right align-top';

/** Inline "reason" prompt used before decisions that are written to the audit log. */
export function ReasonForm({
  label,
  confirmLabel,
  tone = 'ink',
  pending,
  onSubmit,
  onCancel,
}: {
  label: string;
  confirmLabel: string;
  tone?: 'ink' | 'shu';
  pending: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const ok = reason.trim().length >= 10;
  return (
    <form
      className="mt-3 space-y-2 rounded-lg border border-line bg-washi p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSubmit(reason.trim());
      }}
    >
      <label className="block text-xs font-medium text-ink">
        {label}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          className="mt-1 block w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-sm font-normal text-ink focus-visible:outline-2"
        />
      </label>
      <p className="text-xs text-ink-3">{t.admin.common.reasonHint}</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant={tone} disabled={!ok || pending}>
          {confirmLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t.admin.common.cancel}
        </Button>
      </div>
    </form>
  );
}
