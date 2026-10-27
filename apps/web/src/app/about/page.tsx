import { InfoPage } from '@/components/info-page';
import { getI18n } from '@/i18n/server';

export default async function AboutPage() {
  const { t } = await getI18n();
  return (
    <InfoPage title={t.footer.about}>
      <p>{t.footer.tagline}</p>
      <p>{t.footer.disclaimer}</p>
    </InfoPage>
  );
}
