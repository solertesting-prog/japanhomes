import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '@jpt/shared';
import adminEn, { type AdminDictionary } from './admin-en';
import adminEs from './admin-es';
import adminJa from './admin-ja';
import appEn, { type AppDictionary } from './app-en';
import appEs from './app-es';
import appJa from './app-ja';
import en, { type Dictionary as BaseDictionary } from './en';
import es from './es';
import ja from './ja';

export type Dictionary = BaseDictionary & { app: AppDictionary; admin: AdminDictionary };
export type { Locale };

const DICTIONARIES: Record<Locale, Dictionary> = {
  en: { ...en, app: appEn, admin: adminEn },
  ja: { ...ja, app: appJa, admin: adminJa },
  es: { ...es, app: appEs, admin: adminEs },
};

export const LOCALE_COOKIE = 'jpt_locale';

export const LOCALE_LABELS: Record<Locale, string> = { en: 'English', ja: '日本語', es: 'Español' };

/** BCP-47 tags used for Intl formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', ja: 'ja-JP', es: 'es-ES' };

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Picks the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: (tag ?? '').toLowerCase().split('-')[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}
