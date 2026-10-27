import { InfoPage } from '@/components/info-page';
import { getI18n } from '@/i18n/server';

export default async function ContactPage() {
  const { t } = await getI18n();
  return (
    <InfoPage title={t.footer.contact} backLabel={t.info.backHome}>
      <p>{t.info.draft}</p>
    </InfoPage>
  );
}
