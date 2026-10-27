'use client';

import { Button, IconAlert } from '@jpt/ui';
import { useEffect } from 'react';
import { useI18n } from '@/i18n/provider';

export default function PropertiesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page py-24">
      <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-line p-8 text-center">
        <IconAlert size={28} className="mx-auto text-kincha" />
        <h1 className="mt-4 font-display text-2xl text-ink">{t.market.errorTitle}</h1>
        <p className="mt-2 text-sm text-ink-2">{t.market.errorBody}</p>
        {error.digest && <p className="num mt-3 text-xs text-ink-3">Ref: {error.digest}</p>}
        <Button className="mt-6" onClick={reset}>
          {t.market.retry}
        </Button>
      </div>
    </div>
  );
}
