/**
 * i18next instance and the app's language-preference lifecycle.
 *
 * Resolution order on cold start: a server-persisted `locale` (once the
 * authenticated user is known — see LocaleProvider) beats a locally cached
 * choice, which beats the device's own language, which beats `en`. All three
 * of the first are async, so this module initialises synchronously to `en`
 * (never blank) and `bootstrapLocale()` corrects it before first paint where
 * it can.
 */

import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { LOCALE_STORAGE_KEY, preferencesStore } from '../../services/storage/preferencesStore.ts';
import en from './locales/en.ts';
import vi from './locales/vi.ts';
import ko from './locales/ko.ts';
import ja from './locales/ja.ts';
import fr from './locales/fr.ts';
import de from './locales/de.ts';
import zh from './locales/zh.ts';
import ru from './locales/ru.ts';
import es from './locales/es.ts';
import hi from './locales/hi.ts';

export const SUPPORTED_LOCALES = ['en', 'vi', 'ko', 'ja', 'fr', 'de', 'zh', 'ru', 'es', 'hi'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: SupportedLocale = 'en';

function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value !== null && value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function deviceLocale(): SupportedLocale {
  const tag = Localization.getLocales()[0]?.languageCode;
  return isSupportedLocale(tag) ? tag : DEFAULT_LOCALE;
}

void i18next.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  resources: {
    en: { translation: en },
    vi: { translation: vi },
    ko: { translation: ko },
    ja: { translation: ja },
    fr: { translation: fr },
    de: { translation: de },
    zh: { translation: zh },
    ru: { translation: ru },
    es: { translation: es },
    hi: { translation: hi },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

if (__DEV__) {
  warnOnKeyMismatch(en, vi, 'vi.ts');
  warnOnKeyMismatch(en, ko, 'ko.ts');
  warnOnKeyMismatch(en, ja, 'ja.ts');
  warnOnKeyMismatch(en, fr, 'fr.ts');
  warnOnKeyMismatch(en, de, 'de.ts');
  warnOnKeyMismatch(en, zh, 'zh.ts');
  warnOnKeyMismatch(en, ru, 'ru.ts');
  warnOnKeyMismatch(en, es, 'es.ts');
  warnOnKeyMismatch(en, hi, 'hi.ts');
}

/**
 * Locale files are typed against `en.ts`'s shape (`TranslationResource`), so a
 * missing key is already a build-time error — this only catches the other
 * direction: a key a locale has that `en.ts` doesn't (a typo'd path, or a key
 * added to one file and forgotten in the other), which the type system can't
 * see since extra properties are structurally invisible to a type
 * that's merely "at least this shape". Dev-only: a warning, not a throw, so
 * a translation gap degrades to showing the key/English rather than crashing.
 */
function warnOnKeyMismatch(reference: object, other: object, targetName = 'locale', path = ''): void {
  const referenceKeys = new Set(Object.keys(reference));
  const otherKeys = new Set(Object.keys(other));

  for (const key of otherKeys) {
    if (!referenceKeys.has(key)) {
      console.warn(`[i18n] ${targetName} has a key en.ts does not: ${path}${key}`);
      continue;
    }
    const referenceValue = (reference as Record<string, unknown>)[key];
    const otherValue = (other as Record<string, unknown>)[key];
    if (typeof referenceValue === 'object' && referenceValue !== null && typeof otherValue === 'object' && otherValue !== null) {
      warnOnKeyMismatch(referenceValue, otherValue, targetName, `${path}${key}.`);
    }
  }
}

/** Cached-then-device locale, applied before first paint where the timing allows. */
export async function bootstrapLocale(): Promise<SupportedLocale> {
  const cached = await preferencesStore.get(LOCALE_STORAGE_KEY);
  const resolved = isSupportedLocale(cached) ? cached : deviceLocale();
  if (resolved !== i18next.language) await i18next.changeLanguage(resolved);
  return resolved;
}

/** Sets the in-memory language and caches it; does not touch the server — see LocaleProvider.setLocale for that. */
export async function setCachedLocale(locale: SupportedLocale): Promise<void> {
  await i18next.changeLanguage(locale);
  await preferencesStore.set(LOCALE_STORAGE_KEY, locale);
}

export default i18next;
