import { buttonVariants } from '@jpt/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function InfoPage({ title, children, backLabel }: { title: string; children: ReactNode; backLabel?: string }) {
  return (
    <div className="container-page py-16 md:py-24">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{title}</h1>
        <div className="mt-6 space-y-4 leading-relaxed text-ink-2">{children}</div>
        {backLabel && (
          <Link href="/" className={`${buttonVariants({ variant: 'outline' })} mt-10`}>
            {backLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
