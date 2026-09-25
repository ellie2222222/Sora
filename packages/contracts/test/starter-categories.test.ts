import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { CATEGORY_TYPES } from '../src/enums.ts';
import { createCategorySchema } from '../src/schemas.ts';
import { STARTER_CATEGORIES } from '../src/starter-categories.ts';

const WALLET = '11111111-1111-4111-8111-111111111111';

describe('STARTER_CATEGORIES', () => {
  it('has no two names equal ignoring case, whatever their type', () => {
    // uq_category_name_per_parent is (wallet_id, parent, LOWER(name)) without type; every
    // starter is a root, so one collision fails the seed insert and with it every registration.
    const seen = new Map<string, string>();
    for (const category of STARTER_CATEGORIES) {
      const key = category.name.toLowerCase();
      assert.equal(seen.has(key), false, `"${category.name}" collides with "${seen.get(key)}"`);
      seen.set(key, category.name);
    }
  });

  it('uses only category types the schema allows', () => {
    for (const category of STARTER_CATEGORIES) {
      assert.ok(
        (CATEGORY_TYPES as readonly string[]).includes(category.type),
        `${category.name} has type ${category.type}`,
      );
    }
  });

  it('passes the same validation a user-created category must', () => {
    for (const category of STARTER_CATEGORIES) {
      const result = createCategorySchema.safeParse({ walletId: WALLET, ...category });
      assert.equal(result.success, true, `${category.name}: ${JSON.stringify(result.error?.issues)}`);
    }
  });

  it('seeds at least one INCOME and one EXPENSE category, which those transactions require', () => {
    const types = new Set(STARTER_CATEGORIES.map((category) => category.type));
    assert.ok(types.has('INCOME'));
    assert.ok(types.has('EXPENSE'));
  });
});
