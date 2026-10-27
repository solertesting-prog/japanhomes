'use client';

import { Badge, Button, buttonVariants } from '@jpt/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { type FormEvent, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { api } from '@/lib/client-api';
import { useRequireSession, useSession } from '@/lib/session';
import { Field, Notice, PageSpinner, useErrorText } from './ui';

export function AccountView() {
  const { t } = useI18n();
  const ac = t.app.account;
  const { me, ready } = useRequireSession();
  const { signOut, refresh } = useSession();
  const router = useRouter();
  // Kept here, not in <MfaSetup>: once MFA is on, the session refresh unmounts
  // the setup form and its own success message would vanish with it.
  const [mfaJustEnabled, setMfaJustEnabled] = useState(false);
  if (!ready || !me) return <PageSpinner />;
  const [kycLabel] = t.app.kyc.status[me.kycStatus] ?? [me.kycStatus];

  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="font-display text-4xl text-ink">{ac.title}</h1>

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="text-lg font-medium text-ink">{ac.profile}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">{ac.email}</dt>
            <dd className="text-ink">{me.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-2">{ac.roles}</dt>
            <dd className="flex flex-wrap justify-end gap-1.5">
              {me.roles.map((r) => (
                <Badge key={r}>{r.replace(/_/g, ' ').toLowerCase()}</Badge>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="text-lg font-medium text-ink">{ac.identity}</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-ink-2">{kycLabel}</p>
          <Link href="/verify" className={buttonVariants({ variant: me.kycStatus === 'APPROVED' ? 'outline' : 'ink', size: 'sm' })}>
            {me.kycStatus === 'APPROVED' ? ac.viewStatus : ac.goVerify}
          </Link>
        </div>
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="text-lg font-medium text-ink">{ac.security}</h2>
        <p className="mt-2 text-sm text-ink-2">{me.mfaEnabled ? ac.mfaOn : ac.mfaOff}</p>
        {mfaJustEnabled && (
          <div className="mt-4">
            <Notice tone="success">{ac.mfaEnabled}</Notice>
          </div>
        )}
        {!me.mfaEnabled && (
          <MfaSetup
            onEnabled={async () => {
              setMfaJustEnabled(true);
              await refresh();
            }}
          />
        )}
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            router.replace('/');
          }}
        >
          {ac.signOut}
        </Button>
      </section>
    </div>
  );
}

function MfaSetup({ onEnabled }: { onEnabled: () => Promise<unknown> }) {
  const { t } = useI18n();
  const ac = t.app.account;
  const errText = useErrorText();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ secret: string; otpauthUri: string }>('/auth/mfa/setup', { method: 'POST' });
      // QR is rendered locally; the secret never leaves this page.
      const qr = await QRCode.toDataURL(r.otpauthUri, { margin: 1, width: 192, errorCorrectionLevel: 'M' });
      setSetup({ secret: r.secret, qr });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function enable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/mfa/enable', { body: { code } });
      setDone(true);
      setSetup(null);
      await onEnabled();
    } catch (err) {
      setError(errText(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (done) return null;

  return (
    <div className="mt-5 space-y-5">
      {error && <Notice tone="error">{error}</Notice>}
      {!setup ? (
        <Button onClick={start} disabled={busy}>
          {ac.mfaSetup}
        </Button>
      ) : (
        <div className="grid gap-6 rounded-[var(--radius-card)] border border-line p-6 sm:grid-cols-[12rem_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="" width={192} height={192} className="rounded-md border border-line" />
          <div className="space-y-4 text-sm">
            <p className="text-ink-2">{ac.mfaScan}</p>
            <div>
              <p className="text-xs text-ink-3">{ac.mfaManual}</p>
              <code className="num mt-1 block break-all rounded bg-washi px-2 py-1.5 text-ink">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
            </div>
            <form onSubmit={enable} className="flex items-end gap-3">
              <div className="flex-1">
                <Field
                  label={ac.mfaEnterCode}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="num mt-1.5 tracking-[0.3em]"
                />
              </div>
              <Button type="submit" disabled={busy || code.length !== 6}>
                {ac.mfaEnable}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
