'use client';

import type { MeDto } from '@jpt/shared';
import { Button, buttonVariants, Checkbox } from '@jpt/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { api } from '@/lib/client-api';
import { useSession } from '@/lib/session';
import { AuthShell, DevOutbox, Field, Notice, useErrorText } from './ui';

/** Only same-site relative paths are accepted as redirect targets. */
export function safeNext(value: string | null, fallback = '/dashboard'): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback;
}

/* Sign in (password, then TOTP when enabled) ------------------------------------ */

export function SignInForm() {
  const { t } = useI18n();
  const a = t.app.auth;
  const errText = useErrorText();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { me, refresh } = useSession();
  const [step, setStep] = useState<'password' | 'mfa'>(params.get('step') === 'mfa' ? 'mfa' : 'password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me && !me.mfaPending) router.replace(next);
    if (me?.mfaPending) setStep('mfa');
  }, [me, next, router]);
  useEffect(() => {
    if (step === 'mfa') codeRef.current?.focus();
  }, [step]);

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<MeDto>('/auth/login', { body: { email, password } });
      setPassword('');
      if (res.mfaPending) setStep('mfa');
      await refresh();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<MeDto>('/auth/mfa/verify', { body: { code } });
      await refresh();
    } catch (err) {
      setError(errText(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'mfa') {
    return (
      <AuthShell title={a.mfaTitle} lede={a.mfaLede}>
        <form onSubmit={submitCode} className="space-y-5" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field
            ref={codeRef}
            label={a.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="num mt-1.5 text-center text-xl tracking-[0.4em]"
            required
          />
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {a.verify}
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={a.signInTitle} lede={a.signInLede}>
      <form onSubmit={submitPassword} className="space-y-5" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label={a.email} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label={a.password} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full" disabled={busy || !email || !password}>
          {busy ? a.signingIn : a.signIn}
        </Button>
      </form>
      <div className="mt-6 flex flex-col gap-2 text-sm text-ink-2">
        <Link href="/forgot-password" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
          {a.forgot}
        </Link>
        <p>
          {a.noAccount}{' '}
          <Link href={`/sign-up${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu">
            {a.createAccount}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

/* Sign up ------------------------------------------------------------------------ */

export function SignUpForm() {
  const { t, locale } = useI18n();
  const a = t.app.auth;
  const errText = useErrorText();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/register', { body: { email, password, locale, acceptTerms: terms, acceptPrivacy: privacy } });
      setSentTo(email.trim().toLowerCase());
      setPassword('');
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthShell title={a.checkEmailTitle}>
        <Notice>{a.checkEmailBody(sentTo)}</Notice>
        <DevOutbox email={sentTo} type="auth.verify_email" />
      </AuthShell>
    );
  }

  const tooShort = password.length > 0 && password.length < 12;
  return (
    <AuthShell title={a.signUpTitle} lede={a.signUpLede}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label={a.email} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field
          label={a.password}
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={a.passwordHint}
          error={tooShort ? a.passwordHint : null}
          required
        />
        <div className="space-y-3 text-sm text-ink-2">
          <label className="flex items-start gap-2.5">
            <Checkbox className="mt-0.5" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              {a.acceptTerms}{' '}
              <Link href="/legal/terms" target="_blank" className="underline underline-offset-4">({a.read})</Link>
            </span>
          </label>
          <label className="flex items-start gap-2.5">
            <Checkbox className="mt-0.5" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
            <span>
              {a.acceptPrivacy}{' '}
              <Link href="/legal/privacy" target="_blank" className="underline underline-offset-4">({a.read})</Link>
            </span>
          </label>
        </div>
        <Button type="submit" className="w-full" disabled={busy || !email || password.length < 12 || !terms || !privacy}>
          {busy ? a.creating : a.signUp}
        </Button>
      </form>
      <p className="mt-6 text-sm text-ink-2">
        {a.haveAccount}{' '}
        <Link href="/sign-in" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu">
          {a.signIn}
        </Link>
      </p>
    </AuthShell>
  );
}

/* Email verification ------------------------------------------------------------- */

export function VerifyEmail() {
  const { t } = useI18n();
  const a = t.app.auth;
  const errText = useErrorText();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api('/auth/verify-email', { body: { token } })
      .then(() => setState('done'))
      .catch((e) => {
        setError(errText(e));
        setState('error');
      });
  }, [token, errText]);

  return (
    <AuthShell title={a.verifyTitle}>
      {state === 'working' && <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-ink" aria-busy="true" />}
      {state === 'done' && (
        <>
          <Notice tone="success">{a.verified}</Notice>
          <Link href="/sign-in" className={`${buttonVariants({ variant: 'ink' })} mt-6`}>
            {a.goSignIn}
          </Link>
        </>
      )}
      {state === 'error' && <Notice tone="error">{error}</Notice>}
    </AuthShell>
  );
}

/* Password reset ------------------------------------------------------------------- */

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const a = t.app.auth;
  const errText = useErrorText();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/password/forgot', { body: { email } });
      setSent(email.trim().toLowerCase());
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={a.forgotTitle} lede={a.forgotLede}>
      {sent ? (
        <>
          <Notice>{a.linkSent}</Notice>
          <DevOutbox email={sent} type="auth.password_reset" />
        </>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label={a.email} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={busy || !email}>
            {a.sendLink}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const { t } = useI18n();
  const a = t.app.auth;
  const errText = useErrorText();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/password/reset', { body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={a.resetTitle}>
      {done ? (
        <>
          <Notice tone="success">{a.passwordChanged}</Notice>
          <Link href="/sign-in" className={`${buttonVariants({ variant: 'ink' })} mt-6`}>
            {a.goSignIn}
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field
            label={a.newPassword}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={a.passwordHint}
            minLength={12}
            required
          />
          <Button type="submit" className="w-full" disabled={busy || password.length < 12}>
            {a.setPassword}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
