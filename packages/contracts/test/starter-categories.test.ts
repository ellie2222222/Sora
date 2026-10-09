import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { CATEGORY_TYPES, LOCALES } from '../src/enums.ts';
import { createCategorySchema } from '../src/schemas.ts';
import { localizedCategoryName, STARTER_CASH_ACCOUNT_NAME, STARTER_CATEGORIES, starterWalletName } from '../src/starter-categories.ts';

const WALLET = '11111111-1111-4111-8111-111111111111';

describe('STARTER_CATEGORIES', () => {
  it('has no two names equal ignoring case in any locale, whatever their type', () => {
    // uq_category_name_per_parent is (wallet_id, parent, LOWER(name)) without type, over the stored English
    // name; every starter is a root, so one collision fails the seed insert and with it every registration.
    // The other locales must not collide either, or two starters would read the same in that language.
    for (const locale of LOCALES) {
      const seen = new Map<string, string>();
      for (const category of STARTER_CATEGORIES) {
        const key = category.names[locale].toLowerCase();
        assert.equal(seen.has(key), false, `${locale}: "${category.names[locale]}" collides with "${seen.get(key)}"`);
        seen.set(key, category.names[locale]);
      }
    }
  });

  it('has a unique key per starter, in the shape system_key admits', () => {
    const keys = STARTER_CATEGORIES.map((category) => category.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.every((key) => /^[a-z_]{1,50}$/.test(key)));
  });

  it('names the default wallet and Cash account in each locale', () => {
    assert.equal(starterWalletName('An', 'en'), "An's Wallet");
    assert.equal(starterWalletName('An', 'vi'), 'Ví của An');
    assert.equal(STARTER_CASH_ACCOUNT_NAME.en, 'Cash');
    assert.equal(STARTER_CASH_ACCOUNT_NAME.vi, 'Tiền mặt');
    for (const locale of LOCALES) {
      assert.ok(starterWalletName('An', locale).includes('An'), locale);
      assert.ok(STARTER_CASH_ACCOUNT_NAME[locale].trim().length > 0, locale);
    }
  });

  // The seed inserts every starter under one wallet, and uq_category_name_per_parent compares LOWER(name).
  it('gives every starter a distinct name in every locale', () => {
    for (const locale of LOCALES) {
      const names = STARTER_CATEGORIES.map((category) => category.names[locale].toLocaleLowerCase(locale));
      assert.equal(new Set(names).size, names.length, locale);
    }
  });

  it('names a starter in the requested locale and leaves a custom category as typed', () => {
    assert.equal(localizedCategoryName({ name: 'Food', systemKey: 'food' }, 'vi'), 'Ăn uống');
    assert.equal(localizedCategoryName({ name: 'Food', systemKey: 'food' }, 'en'), 'Food');
    assert.equal(localizedCategoryName({ name: 'Tiền chợ', systemKey: null }, 'en'), 'Tiền chợ');
    assert.equal(localizedCategoryName({ name: 'Legacy', systemKey: 'no-such-key' }, 'vi'), 'Legacy');
  });

  it('uses only category types the schema allows', () => {
    for (const category of STARTER_CATEGORIES) {
      assert.ok(
        (CATEGORY_TYPES as readonly string[]).includes(category.type),
        `${category.names.en} has type ${category.type}`,
      );
    }
  });

  it('passes the same validation a user-created category must', () => {
    for (const category of STARTER_CATEGORIES) {
      for (const locale of LOCALES) {
        const { names, type, icon, color } = category;
        const result = createCategorySchema.safeParse({ walletId: WALLET, name: names[locale], type, icon, color });
        assert.equal(result.success, true, `${names[locale]}: ${JSON.stringify(result.error?.issues)}`);
      }
    }
  });

  it('seeds at least one INCOME and one EXPENSE category, which those transactions require', () => {
    const types = new Set(STARTER_CATEGORIES.map((category) => category.type));
    assert.ok(types.has('INCOME'));
    assert.ok(types.has('EXPENSE'));
  });
});
