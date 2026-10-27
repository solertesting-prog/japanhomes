'use client';

import { cn, IconAlert, IconInfo, Input } from '@jpt/ui';
import { forwardRef, type InputHTMLAttributes, type ReactNode, useEffect, useId, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { api, ApiClientError, DEV_TOOLS } from '@/lib/client-api';

/** Centered column for sign-in style pages. */
export function AuthShell({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-14 md:py-20">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl text-ink sm:text-[2.25rem]">{title}</h1>
        {lede && <p className="mt-2 text-ink-2">{lede}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null };

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, ...props }, ref) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <Input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={hint || error ? `${id}-desc` : undefined}
        className={cn('mt-1.5', error && 'border-shu')}
        {...props}
      />
      {(hint || error) && (
        <p id={`${id}-desc`} className={cn('mt-1.5 text-xs', error ? 'text-shu-deep' : 'text-ink-3')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    info: 'border-line bg-washi text-ink-2',
    error: 'border-shu/30 bg-shu-tint text-shu-deep',
    success: 'border-matcha/30 bg-matcha-tint text-matcha',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-2.5 rounded-lg border px-4 py-3 text-sm', styles)}>
      {tone === 'error' ? <IconAlert size={17} className="mt-0.5 shrink-0" /> : <IconInfo size={17} className="mt-0.5 shrink-0" />}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/** Maps API error codes to the visitor's language. */
export function useErrorText() {
  const { t } = useI18n();
  return (e: unknown): string => {
    if (e instanceof ApiClientError) return t.app.errors[e.code] ?? e.message ?? t.app.errors.generic!;
    return t.app.errors.generic!;
  };
}

/** Development only: shows the latest email the mock mailer "sent" to an address. */
export function DevOutbox({ email, type, refreshKey }: { email: string; type: string; refreshKey?: unknown }) {
  const { t } = useI18n();
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    if (!DEV_TOOLS || !email) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await api<{ items: Array<{ type: string; body: string }> }>(`/dev/outbox?email=${encodeURIComponent(email)}`);
        const item = r.items.find((i) => i.type === type);
        const url = item?.body.match(/https?:\/\/\S+/)?.[0] ?? null;
        if (alive) setLink(url ? url.replace(/^https?:\/\/[^/]+/, '') : null);
      } catch {
        /* outbox unavailable: nothing to show */
      }
    };
    void load();
    const timer = setInterval(load, 2_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [email, type, refreshKey]);
  if (!DEV_TOOLS || !link) return null;
  return (
    <div className="mt-6 rounded-lg border border-dashed border-line-strong p-4 text-sm">
      <p className="text-xs text-ink-3">{t.app.auth.devOutbox}</p>
      <a href={link} className="mt-1 inline-block font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu">
        {t.app.auth.devOpenLink}
      </a>
    </div>
  );
}

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className="flex items-center gap-2">
          <span
            className={cn(
              'num grid h-6 w-6 place-items-center rounded-full text-xs',
              i < current ? 'bg-ink text-paper' : i === current ? 'bg-shu text-white' : 'bg-washi-deep text-ink-3',
            )}
          >
            {i + 1}
          </span>
          <span className={i === current ? 'font-medium text-ink' : 'text-ink-3'}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function PageSpinner() {
  return (
    <div className="container-page py-24" aria-busy="true">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
    </div>
  );
}
