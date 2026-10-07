import type { Locale } from '@sora/contracts';

let active: Locale = 'en';

/**
 * The app's current language, readable outside React: the API client sends it as
 * Accept-Language, and guest mode names starter categories in it. Set only by LocaleProvider.
 */
export function activeLocale(): Locale {
  return active;
}

export function setActiveLocale(locale: Locale): void {
  active = locale;
}
