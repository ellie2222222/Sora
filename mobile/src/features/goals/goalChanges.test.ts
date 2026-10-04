import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { goalChanges } from './goalChanges.ts';

const saved = { name: 'Trip', description: null, targetAmount: '5000000.0000', targetDate: '2026-12-31' };
const unchanged = { name: 'Trip', description: '', targetAmount: '5000000.0000', targetDate: '2026-12-31' };

describe('goalChanges', () => {
  it('is empty when nothing differs, treating a blank description as none', () => {
    assert.deepEqual(goalChanges(saved, unchanged), {});
    assert.deepEqual(goalChanges(saved, { ...unchanged, description: '   ' }), {});
  });

  it('sends only the fields that changed', () => {
    assert.deepEqual(goalChanges(saved, { ...unchanged, name: 'Japan', targetAmount: '6000000.0000' }), {
      name: 'Japan',
      targetAmount: '6000000.0000',
    });
  });

  it('sends a cleared deadline and description as null', () => {
    const withBoth = { ...saved, description: 'Spring', targetDate: '2026-12-31' };
    assert.deepEqual(goalChanges(withBoth, { ...unchanged, description: '', targetDate: null }), {
      description: null,
      targetDate: null,
    });
  });
});
