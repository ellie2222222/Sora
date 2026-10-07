import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { budgetPeriodLabel } from './budgetPeriod.ts';

describe('budgetPeriodLabel', () => {
  it('names a calendar month, a calendar year and a single day', () => {
    assert.equal(budgetPeriodLabel({ periodStart: '2026-10-01', periodEnd: '2026-10-31' }, 'en'), 'Oct 2026');
    assert.equal(budgetPeriodLabel({ periodStart: '2026-01-01', periodEnd: '2026-12-31' }, 'en'), '2026');
    assert.equal(budgetPeriodLabel({ periodStart: '2026-10-09', periodEnd: '2026-10-09' }, 'en'), 'Oct 9, 2026');
  });

  it('falls back to the range for a week, an off-calendar month or a custom window', () => {
    assert.equal(budgetPeriodLabel({ periodStart: '2026-10-05', periodEnd: '2026-10-11' }, 'en'), 'Oct 5 – Oct 11');
    assert.equal(budgetPeriodLabel({ periodStart: '2026-10-15', periodEnd: '2026-11-14' }, 'en'), 'Oct 15 – Nov 14');
  });
});
