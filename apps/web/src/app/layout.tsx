import type { Metadata, Viewport } from 'next';
import { Shippori_Mincho_B1, Zen_Kaku_Gothic_New } from 'next/font/google';
import type { ReactNode } from 'react';
import { DemoBanner, SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { I18nProvider } from '@/i18n/provider';
import { getI18n } from '@/i18n/server';
import { SessionProvider } from '@/lib/session';
import './globals.css';

// Self-hosted at build time by next/font: no runtime request to Google.
const mincho = Shippori_Mincho_B1({
  weight: ['500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mincho',
  preload: true,
});
const gothic = Zen_Kaku_Gothic_New({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-gothic',
  preload: true,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t.meta.title, template: '%s — Japan Property Token' },
    description: t.meta.description,
    openGraph: {
      type: 'website',
      siteName: 'Japan Property Token',
      title: t.meta.title,
      description: t.meta.description,
      locale: { en: 'en_US', ja: 'ja_JP', es: 'es_ES' }[locale],
    },
    twitter: { card: 'summary_large_image', title: t.meta.title, description: t.meta.description },
    // Prototype with fictional data: keep it out of search indexes until launch.
    robots: process.env.JPT_ALLOW_INDEXING === 'true' ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getI18n();
  return (
    <html lang={locale} className={`${mincho.variable} ${gothic.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <I18nProvider locale={locale}>
          <SessionProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
            Skip to content
          </a>
          <DemoBanner />
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
