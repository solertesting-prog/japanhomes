'use client';

import { Button } from '@jpt/ui';
import { useEffect } from 'react';
import { useI18n } from '@/i18n/provider';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page py-24">
      <div className="max-w-xl">
        <h1 className="font-display text-3xl text-ink">{t.info.errorTitle}</h1>
        <p className="mt-3 text-ink-2">{t.info.errorBody}</p>
        {error.digest && <p className="num mt-2 text-xs text-ink-3">Ref: {error.digest}</p>}
        <Button className="mt-8" onClick={reset}>
          {t.market.retry}
        </Button>
      </div>
    </div>
  );
}
