'use client';

import { isStaff, SUPPORTED_LOCALES } from '@jpt/shared';
import { buttonVariants, cn, IconClose, IconMenu } from '@jpt/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { LOCALE_COOKIE, LOCALE_LABELS, type Locale } from '@/i18n';
import { useI18n } from '@/i18n/provider';
import { useSession } from '@/lib/session';

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-[5px] bg-shu font-display text-[0.6875rem] font-bold tracking-tight text-white">
        JPT
      </span>
      <span className="font-display text-[1.0625rem] font-medium tracking-tight text-ink">Japan Property Token</span>
    </span>
  );
}

function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className={cn('relative flex items-center', className)}>
      <span className="sr-only">{t.nav.language}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Locale;
          document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
          startTransition(() => router.refresh());
        }}
        className="h-9 cursor-pointer appearance-none rounded-md bg-transparent pl-2 pr-2 text-sm text-ink-2 hover:text-ink focus-visible:outline-2"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

function AccountLinks({ mobile = false }: { mobile?: boolean }) {
  const { t } = useI18n();
  const { me, loading } = useSession();
  if (loading) return <span className="h-9 w-40" aria-hidden />;
  if (me && !me.mfaPending) {
    return (
      <>
        <Link href="/dashboard" className={buttonVariants({ variant: mobile ? 'ink' : 'ghost', size: 'sm' })}>
          {t.app.nav.dashboard}
        </Link>
        {me.mfaEnabled && isStaff(me.permissions) && (
          <Link href="/admin" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            {t.admin.title}
          </Link>
        )}
        {!mobile && (
          <Link href="/account" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t.app.nav.account}
          </Link>
        )}
      </>
    );
  }
  return (
    <>
      {!mobile && (
        <Link href="/sign-in" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          {t.nav.signIn}
        </Link>
      )}
      <Link href="/sign-up" className={buttonVariants({ variant: 'ink', size: 'sm' })}>
        {t.nav.createAccount}
      </Link>
    </>
  );
}

export function SiteHeader() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: '/properties', label: t.nav.properties },
    { href: '/#how-it-works', label: t.nav.howItWorks },
    { href: '/risks', label: t.nav.risks },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="Japan Property Token — home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? 'page' : undefined}
              className="rounded-md px-3 py-2 text-[0.9375rem] text-ink-2 transition-colors hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-shu aria-[current=page]:underline-offset-8"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <LocaleSwitcher />
          <AccountLinks />
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-md text-ink md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={t.nav.menu}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <IconClose size={22} /> : <IconMenu size={22} />}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="border-t border-line bg-paper md:hidden">
          <nav aria-label="Main" className="container-page flex flex-col py-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="py-3 text-base text-ink">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-line pt-4">
              <LocaleSwitcher />
              <AccountLinks mobile />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
