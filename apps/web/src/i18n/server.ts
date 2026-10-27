import 'server-only';
import { cookies, headers } from 'next/headers';
import { getDictionary, isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from './index';

/** Locale for the current request: explicit cookie choice, else Accept-Language, else English. */
export async function getRequestLocale(): Promise<Locale> {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieValue)) return cookieValue;
  return negotiateLocale((await headers()).get('accept-language'));
}

export async function getI18n() {
  const locale = await getRequestLocale();
  return { locale, t: getDictionary(locale) };
}
