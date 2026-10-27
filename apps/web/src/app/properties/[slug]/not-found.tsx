import { buttonVariants } from '@jpt/ui';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';

export default async function PropertyNotFound() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-24 text-center">
      <h1 className="font-display text-3xl text-ink">{t.info.notFoundTitle}</h1>
      <p className="mt-3 text-ink-2">{t.info.propertyNotFound}</p>
      <Link href="/properties" className={`${buttonVariants({ variant: 'ink' })} mt-8`}>
        {t.property.back}
      </Link>
    </div>
  );
}
