import { notFound } from 'next/navigation';
import { InfoPage } from '@/components/info-page';
import { getI18n } from '@/i18n/server';

const DOCS = ['notice', 'privacy', 'terms'] as const;

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!(DOCS as readonly string[]).includes(doc)) notFound();
  const { t } = await getI18n();
  const title = { notice: t.footer.legalNotice, privacy: t.footer.privacy, terms: t.footer.terms }[doc as (typeof DOCS)[number]];
  return (
    <InfoPage title={title} backLabel={t.info.backHome}>
      <p>{t.info.draft}</p>
      <p>{t.footer.disclaimer}</p>
    </InfoPage>
  );
}
