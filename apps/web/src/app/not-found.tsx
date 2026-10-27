import { InfoPage } from '@/components/info-page';
import { getI18n } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <InfoPage title={t.info.notFoundTitle} backLabel={t.info.backHome}>
      <p>{t.info.notFoundBody}</p>
    </InfoPage>
  );
}
