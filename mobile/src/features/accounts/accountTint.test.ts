import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ACCOUNT_TINTS } from '../../design-system/colors.ts';
import { accountTint, accountTintIndex } from './accountTint.ts';

const ids = Array.from({ length: 200 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

describe('accountTint', () => {
  it('gives an account the same tint every time and the same slot in dark and light', () => {
    for (const id of ids.slice(0, 20)) {
      assert.equal(accountTint(id, ACCOUNT_TINTS.dark), accountTint(id, ACCOUNT_TINTS.dark));
      assert.equal(accountTint(id, ACCOUNT_TINTS.dark).name, accountTint(id, ACCOUNT_TINTS.light).name);
    }
  });

  it('spreads accounts across every tint', () => {
    const used = new Set(ids.map((id) => accountTintIndex(id, ACCOUNT_TINTS.dark.length)));
    assert.equal(used.size, ACCOUNT_TINTS.dark.length);
  });
});
