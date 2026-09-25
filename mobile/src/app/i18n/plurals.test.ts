import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import i18next from 'i18next';

import en from './locales/en.ts';
import vi from './locales/vi.ts';

function leafKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object' ? leafKeys(value, path) : [path];
  });
}

// Mirrors index.ts's init: `compatibilityJSON: 'v4'` reads `_one`/`_other`, never the old `_plural` suffix.
const i18n = i18next.createInstance();
await i18n.init({
  compatibilityJSON: 'v4',
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, vi: { translation: vi } },
  interpolation: { escapeValue: false },
});

describe('plural keys', () => {
  it('uses only suffixes the v4 plural format reads', () => {
    for (const locale of [en, vi]) {
      assert.deepEqual(leafKeys(locale).filter((key) => key.endsWith('_plural')), []);
    }
  });

  it('gives every `_one` an `_other`', () => {
    const keys = new Set(leafKeys(en));
    for (const key of keys) {
      if (key.endsWith('_one')) assert.ok(keys.has(key.replace(/_one$/, '_other')), key);
    }
  });

  it('picks the singular and plural English forms by count', () => {
    assert.equal(i18n.t('wallets.memberCount', { count: 1 }), '1 member');
    assert.equal(i18n.t('wallets.memberCount', { count: 3 }), '3 members');
  });

  it('resolves Vietnamese, which has one plural form, for any count', () => {
    assert.equal(i18n.t('wallets.memberCount', { count: 3, lng: 'vi' }), '3 thành viên');
  });
});
