import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ERROR_CODE_TO_I18N_KEY } from '../../utils/errors.ts';
import en from './locales/en.ts';
import vi from './locales/vi.ts';

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

const enLeaves = new Map(leafEntries(en));
const viLeaves = new Map(leafEntries(vi));

describe('en/vi locale parity', () => {
  it('defines the same leaf keys in both catalogs', () => {
    const missingInVi = [...enLeaves.keys()].filter((key) => !viLeaves.has(key));
    const extraInVi = [...viLeaves.keys()].filter((key) => !enLeaves.has(key));
    assert.deepEqual({ missingInVi, extraInVi }, { missingInVi: [], extraInVi: [] });
  });

  it('holds a non-empty string at every leaf', () => {
    for (const [locale, leaves] of [['en', enLeaves], ['vi', viLeaves]] as const) {
      for (const [key, value] of leaves) {
        assert.ok(typeof value === 'string' && value.trim().length > 0, `${locale}: ${key}`);
      }
    }
  });

  // A translator dropping or renaming `{{count}}` renders the raw braces, or silently loses the figure.
  it('uses the same {{placeholder}} names for every key', () => {
    const mismatches: string[] = [];
    for (const [key, enValue] of enLeaves) {
      const viValue = viLeaves.get(key);
      if (typeof enValue !== 'string' || typeof viValue !== 'string') continue;
      const expected = placeholders(enValue).join(',');
      const actual = placeholders(viValue).join(',');
      if (expected !== actual) mismatches.push(`${key}: en {${expected}} vi {${actual}}`);
    }
    assert.deepEqual(mismatches, []);
  });
});

describe('error-code translations', () => {
  it('resolves every ERROR_CODE_TO_I18N_KEY target to a string in both locales', () => {
    const unresolved: string[] = [];
    for (const [code, key] of Object.entries(ERROR_CODE_TO_I18N_KEY)) {
      for (const [locale, catalog] of [['en', en], ['vi', vi]] as const) {
        if (typeof resolve(catalog, key) !== 'string') unresolved.push(`${locale}: ${code} -> ${key}`);
      }
    }
    assert.deepEqual(unresolved, []);
  });

  it('defines the offline and generic keys getServerErrorMessage falls back to', () => {
    for (const catalog of [en, vi]) {
      assert.equal(typeof resolve(catalog, 'errors.offlineTitle'), 'string');
      assert.equal(typeof resolve(catalog, 'errors.somethingWentWrong'), 'string');
    }
  });
});
