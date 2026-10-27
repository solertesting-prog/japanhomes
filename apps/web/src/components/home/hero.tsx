'use client';

import type { PropertyCardDto } from '@jpt/shared';
import { buttonVariants } from '@jpt/ui';
import Link from 'next/link';
import { useI18n } from '@/i18n/provider';
import { TokenFacade } from './token-facade';

export function Hero({ example }: { example: PropertyCardDto | null }) {
  const { t } = useI18n();
  return (
    <section className="container-page grid items-center gap-12 pb-16 pt-12 md:pt-20 lg:grid-cols-12 lg:gap-16 lg:pb-24">
      <div className="lg:col-span-7">
        <h1 className="font-display text-[2.5rem] font-medium leading-[1.12] tracking-[-0.01em] text-ink sm:text-[3.25rem] lg:text-[3.75rem]">
          {t.hero.title}
        </h1>
        <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2">{t.hero.subtitle}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/properties" className={buttonVariants({ variant: 'ink', size: 'lg' })}>
            {t.hero.explore}
          </Link>
          <Link href="/#how-it-works" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            {t.hero.how}
          </Link>
        </div>
      </div>
      {example && (
        <div className="mx-auto w-full max-w-md lg:col-span-5 lg:max-w-none">
          <TokenFacade property={example} />
        </div>
      )}
    </section>
  );
}
