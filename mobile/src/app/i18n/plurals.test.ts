import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import i18next from 'i18next';

import { LOCALES } from '@sora/contracts';

import { CATALOGS } from './locales/catalogs.ts';

function leafKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object' ? leafKeys(value, path) : [path];
  });
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Plural bases in en.ts: every key that has an `_other` form. */
const pluralBases = leafKeys(CATALOGS.en)
  .filter((key) => key.endsWith('_other'))
  .map((key) => key.replace(/_other$/, ''));

// Mirrors index.ts's init: `compatibilityJSON: 'v4'` reads `_one`/`_other`, never the old `_plural` suffix.
const i18n = i18next.createInstance();
await i18n.init({
  compatibilityJSON: 'v4',
  lng: 'en',
  fallbackLng: 'en',
  resources: Object.fromEntries(LOCALES.map((locale) => [locale, { translation: CATALOGS[locale] }])),
  interpolation: { escapeValue: false },
});

describe('plural keys', () => {
  it('uses only suffixes the v4 plural format reads', () => {
    for (const locale of LOCALES) {
      assert.deepEqual(leafKeys(CATALOGS[locale]).filter((key) => key.endsWith('_plural')), [], locale);
    }
  });

  it('gives every `_one` an `_other`', () => {
    const keys = new Set(leafKeys(CATALOGS.en));
    for (const key of keys) {
      if (key.endsWith('_one')) assert.ok(keys.has(key.replace(/_one$/, '_other')), key);
    }
  });

  // A form the language's rules pick but the catalog lacks falls back to English for those counts.
  it('defines every plural form each language uses', () => {
    const missing: string[] = [];
    for (const locale of LOCALES) {
      const keys = new Set(leafKeys(CATALOGS[locale]));
      const forms = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
      for (const base of pluralBases) {
        for (const form of forms) {
          if (!keys.has(`${base}_${form}`)) missing.push(`${locale}: ${base}_${form}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  it('adds no plural form outside a base en.ts has', () => {
    const stray: string[] = [];
    for (const locale of LOCALES) {
      for (const key of leafKeys(CATALOGS[locale])) {
        if (PLURAL_SUFFIX.test(key) && !pluralBases.includes(key.replace(PLURAL_SUFFIX, ''))) stray.push(`${locale}: ${key}`);
      }
    }
    assert.deepEqual(stray, []);
  });

  it('picks the singular and plural English forms by count', () => {
    assert.equal(i18n.t('wallets.memberCount', { count: 1 }), '1 member');
    assert.equal(i18n.t('wallets.memberCount', { count: 3 }), '3 members');
  });

  it('resolves Vietnamese, which has one plural form, for any count', () => {
    assert.equal(i18n.t('wallets.memberCount', { count: 3, lng: 'vi' }), '3 thành viên');
  });

  it('resolves every language to its own text, not the English fallback, for 1, 3 and 5', () => {
    const fellBack: string[] = [];
    for (const locale of LOCALES.filter((locale) => locale !== 'en')) {
      for (const count of [1, 3, 5]) {
        const text = i18n.t('wallets.memberCount', { count, lng: locale });
        if (text === i18n.t('wallets.memberCount', { count, lng: 'en' })) fellBack.push(`${locale}: ${count}`);
      }
    }
    assert.deepEqual(fellBack, []);
  });
});
