'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/provider';

export function DemoBanner() {
  const { t } = useI18n();
  return (
    <div className="bg-ink text-paper">
      <p className="container-page py-2 text-center text-[0.8125rem] leading-snug">
        <span className="mr-2 inline-block rounded-sm border border-paper/40 px-1.5 text-[0.6875rem] font-medium">DEMO</span>
        {t.demoBanner}
      </p>
    </div>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  const columns = [
    {
      title: t.footer.platform,
      links: [
        { href: '/properties', label: t.nav.properties },
        { href: '/#how-it-works', label: t.nav.howItWorks },
        { href: '/risks', label: t.nav.risks },
      ],
    },
    {
      title: t.footer.company,
      links: [
        { href: '/about', label: t.footer.about },
        { href: '/contact', label: t.footer.contact },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { href: '/legal/notice', label: t.footer.legalNotice },
        { href: '/legal/privacy', label: t.footer.privacy },
        { href: '/legal/terms', label: t.footer.terms },
      ],
    },
  ];
  return (
    <footer className="bg-ink text-paper">
      <div className="container-page grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="flex items-center gap-2.5">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-[5px] bg-shu font-display text-[0.6875rem] font-bold text-white">
              JPT
            </span>
            <span className="font-display text-[1.0625rem]">Japan Property Token</span>
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/65">{t.footer.tagline}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="md:col-span-2">
            <h2 className="text-sm font-medium text-paper">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-paper/65 transition-colors hover:text-paper">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-paper/15">
        <p className="container-page py-6 text-xs leading-relaxed text-paper/50">
          {t.footer.disclaimer} © {new Date().getFullYear()} Japan Property Token (prototype).
        </p>
      </div>
    </footer>
  );
}
