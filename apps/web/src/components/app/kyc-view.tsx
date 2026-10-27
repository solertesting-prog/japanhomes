'use client';

import { Button, buttonVariants, Checkbox, cn, Select } from '@jpt/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { INTL_LOCALE } from '@/i18n';
import { useI18n } from '@/i18n/provider';
import { api, DEV_TOOLS } from '@/lib/client-api';
import { countryOptions } from '@/lib/countries';
import { useRequireSession, useSession } from '@/lib/session';
import { safeNext } from './auth-forms';
import { Notice, PageSpinner, useErrorText } from './ui';

interface KycStatus {
  id: string | null;
  status: 'NOT_STARTED' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  eligibility: { simulatedAllowed: boolean; realAllowed: boolean } | null;
}

export function KycView() {
  const { t, locale } = useI18n();
  const k = t.app.kyc;
  const errText = useErrorText();
  const { ready } = useRequireSession();
  const { refresh } = useSession();
  const next = useSearchParams().get('next');
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [country, setCountry] = useState('');
  const [nationality, setNationality] = useState('');
  const [entity, setEntity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useMemo(() => countryOptions(INTL_LOCALE[locale]), [locale]);

  const load = useCallback(async () => {
    try {
      const s = await api<KycStatus>('/kyc');
      setStatus(s);
      // Approval grants a role: refresh the session so gated pages open.
      if (s.status === 'APPROVED') await refresh();
    } catch (e) {
      setError(errText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useEffect(() => {
    if (ready) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // While the provider is working, poll for the result.
  useEffect(() => {
    if (status?.status !== 'PENDING') return;
    const id = setInterval(load, 3_000);
    return () => clearInterval(id);
  }, [status?.status, load]);

  async function start(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setStatus(await api<KycStatus>('/kyc/start', { body: { countryOfResidence: country, nationality, isEntity: entity } }));
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function simulate(outcome: 'clear' | 'consider' | 'fail') {
    setBusy(true);
    setError(null);
    try {
      await api('/dev/kyc/complete', { body: { outcome } });
      await load();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !status) return <PageSpinner />;
  const [label, body] = k.status[status.status] ?? [status.status, ''];
  const canStart = status.status === 'NOT_STARTED' || status.status === 'REJECTED' || status.status === 'EXPIRED';

  return (
    <div className="container-page max-w-2xl py-14">
      <h1 className="font-display text-4xl text-ink">{k.title}</h1>
      <p className="mt-3 leading-relaxed text-ink-2">{k.lede}</p>

      <div
        className={cn(
          'mt-8 rounded-[var(--radius-card)] border p-5',
          status.status === 'APPROVED' ? 'border-matcha/40 bg-matcha-tint' : status.status === 'REJECTED' ? 'border-shu/30 bg-shu-tint' : 'border-line bg-washi',
        )}
        role="status"
      >
        <p className="font-medium text-ink">{label}</p>
        <p className="mt-1 text-sm text-ink-2">{body}</p>
        {status.status === 'APPROVED' && status.eligibility && (
          <ul className="mt-3 space-y-1 text-sm text-ink-2">
            {status.eligibility.simulatedAllowed && <li>{k.eligibilitySim}</li>}
            {!status.eligibility.realAllowed && <li>{k.eligibilityReal}</li>}
          </ul>
        )}
      </div>

      {error && <div className="mt-6"><Notice tone="error">{error}</Notice></div>}

      {canStart && (
        <form onSubmit={start} className="mt-8 space-y-5" noValidate>
          <label className="block">
            <span className="text-sm font-medium text-ink">{k.country}</span>
            <Select className="mt-1.5" value={country} onChange={(e) => setCountry(e.target.value)} required>
              <option value="" />
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">{k.nationality}</span>
            <Select className="mt-1.5" value={nationality} onChange={(e) => setNationality(e.target.value)} required>
              <option value="" />
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          </label>
          <label className="flex items-center gap-2.5 text-sm text-ink-2">
            <Checkbox checked={entity} onChange={(e) => setEntity(e.target.checked)} />
            {k.entity}
          </label>
          <Button type="submit" disabled={busy || !country || !nationality}>
            {busy ? k.starting : k.start}
          </Button>
        </form>
      )}

      {DEV_TOOLS && status.status === 'PENDING' && (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong p-5">
          <p className="text-xs text-ink-3">{k.devTitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['clear', 'consider', 'fail'] as const).map((o) => (
              <Button key={o} variant="outline" size="sm" disabled={busy} onClick={() => simulate(o)}>
                {k.outcomes[o]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {status.status === 'APPROVED' && (
        <Link href={safeNext(next, '/properties')} className={`${buttonVariants({ variant: 'shu' })} mt-8`}>
          {k.continueInvest}
        </Link>
      )}
    </div>
  );
}
