import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { LOCALES } from '@sora/contracts';

import { ERROR_CODE_TO_I18N_KEY } from '../../utils/errors.ts';
import { CATALOGS } from './locales/catalogs.ts';

type Catalog = Record<string, unknown>;

function leafEntries(obj: object, prefix = ''): [string, unknown][] {
  return Object.entries(obj).flatMap(([key, value]): [string, unknown][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object' ? leafEntries(value, path) : [[path, value]];
  });
}

function resolve(catalog: Catalog, dottedKey: string): unknown {
  return dottedKey
    .split('.')
    .reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Catalog)[part] : undefined), catalog);
}

/** `{{name}}` and `{{name, format}}` both interpolate `name`. */
function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)].map((match) => match[1]!))].sort();
}

const enLeaves = new Map(leafEntries(CATALOGS.en));
const translated = LOCALES.filter((locale) => locale !== 'en');
const PLURAL_FORM = /_(zero|two|few|many)$/;

describe('locale parity with en', () => {
  it('defines the same leaf keys in every catalog, apart from extra plural forms', () => {
    const drift: string[] = [];
    for (const locale of translated) {
      const leaves = new Map(leafEntries(CATALOGS[locale]));
      for (const key of enLeaves.keys()) if (!leaves.has(key)) drift.push(`${locale} lacks ${key}`);
      for (const key of leaves.keys()) if (!enLeaves.has(key) && !PLURAL_FORM.test(key)) drift.push(`${locale} adds ${key}`);
    }
    assert.deepEqual(drift, []);
  });

  it('holds a non-empty string at every leaf', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of leafEntries(CATALOGS[locale])) {
        assert.ok(typeof value === 'string' && value.trim().length > 0, `${locale}: ${key}`);
      }
    }
  });

  // A translator dropping or renaming `{{count}}` renders the raw braces, or silently loses the figure.
  it('uses the same {{placeholder}} names for every key', () => {
    const mismatches: string[] = [];
    for (const locale of translated) {
      for (const [key, value] of leafEntries(CATALOGS[locale])) {
        const enValue = enLeaves.get(key) ?? enLeaves.get(key.replace(PLURAL_FORM, '_other'));
        if (typeof enValue !== 'string' || typeof value !== 'string') continue;
        const expected = placeholders(enValue).join(',');
        const actual = placeholders(value).join(',');
        if (expected !== actual) mismatches.push(`${locale} ${key}: en {${expected}} ${locale} {${actual}}`);
      }
    }
    assert.deepEqual(mismatches, []);
  });

  it('names every language the same way in every catalog', () => {
    for (const locale of translated) {
      assert.deepEqual(resolve(CATALOGS[locale], 'settings.languageNames'), resolve(CATALOGS.en, 'settings.languageNames'), locale);
    }
  });
});

describe('error-code translations', () => {
  it('resolves every ERROR_CODE_TO_I18N_KEY target to a string in every locale', () => {
    const unresolved: string[] = [];
    for (const [code, key] of Object.entries(ERROR_CODE_TO_I18N_KEY)) {
      for (const locale of LOCALES) {
        if (typeof resolve(CATALOGS[locale], key) !== 'string') unresolved.push(`${locale}: ${code} -> ${key}`);
      }
    }
    assert.deepEqual(unresolved, []);
  });

  it('defines the offline and generic keys getServerErrorMessage falls back to', () => {
    for (const locale of LOCALES) {
      assert.equal(typeof resolve(CATALOGS[locale], 'errors.offlineTitle'), 'string', locale);
      assert.equal(typeof resolve(CATALOGS[locale], 'errors.somethingWentWrong'), 'string', locale);
    }
  });
});
