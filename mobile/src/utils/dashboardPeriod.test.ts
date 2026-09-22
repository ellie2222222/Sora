import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  DASHBOARD_PERIODS,
  isCurrentPeriod,
  previousWindow,
  shiftAnchor,
  windowFor,
} from './dashboardPeriod.ts';

/**
 * These windows are what the dashboard sends as `dateFrom`/`dateTo`, so a wrong
 * boundary silently changes which transactions every figure on the screen
 * counts. 2026-08-17 is a Monday throughout.
 */
const ANCHOR = '2026-08-17';

describe('windowFor', () => {
  it('spans exactly one day for daily', () => {
    assert.deepEqual(windowFor('daily', ANCHOR), { dateFrom: '2026-08-17', dateTo: '2026-08-17' });
  });

  it('aligns to calendar boundaries rather than to the anchor', () => {
    assert.deepEqual(windowFor('weekly', ANCHOR), { dateFrom: '2026-08-16', dateTo: '2026-08-22' });
    assert.deepEqual(windowFor('monthly', ANCHOR), { dateFrom: '2026-08-01', dateTo: '2026-08-31' });
    assert.deepEqual(windowFor('quarterly', ANCHOR), { dateFrom: '2026-07-01', dateTo: '2026-09-30' });
    assert.deepEqual(windowFor('yearly', ANCHOR), { dateFrom: '2026-01-01', dateTo: '2026-12-31' });
  });

  it('never returns an inverted window, for any period', () => {
    for (const period of DASHBOARD_PERIODS) {
      const { dateFrom, dateTo } = windowFor(period, ANCHOR);
      assert.ok(dateFrom <= dateTo, `${period} produced ${dateFrom}..${dateTo}`);
    }
  });
});

describe('shiftAnchor', () => {
  it('moves one whole period at a time', () => {
    assert.equal(shiftAnchor('daily', ANCHOR, 1), '2026-08-18');
    assert.equal(shiftAnchor('weekly', ANCHOR, 1), '2026-08-24');
    assert.equal(shiftAnchor('monthly', ANCHOR, 1), '2026-09-17');
    assert.equal(shiftAnchor('quarterly', ANCHOR, 1), '2026-10-01');
    assert.equal(shiftAnchor('yearly', ANCHOR, 1), '2027-01-01');
  });

  it('moves backwards across a year boundary', () => {
    assert.equal(shiftAnchor('monthly', '2026-01-15', -1), '2025-12-15');
    assert.equal(shiftAnchor('quarterly', '2026-02-10', -1), '2025-10-01');
    assert.equal(shiftAnchor('yearly', '2026-06-01', -1), '2025-01-01');
  });
});

describe('previousWindow', () => {
  it('is a whole prior calendar period, not a fixed-length block', () => {
    // February is 28 days here; a "minus 31 days" window would overlap January.
    assert.deepEqual(previousWindow('monthly', '2026-03-15'), {
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
    });
  });

  it('never overlaps the current window, for any period', () => {
    for (const period of DASHBOARD_PERIODS) {
      const current = windowFor(period, ANCHOR);
      const before = previousWindow(period, ANCHOR);
      assert.ok(before.dateTo < current.dateFrom, `${period}: ${before.dateTo} >= ${current.dateFrom}`);
    }
  });

  it('leaves no gap between the previous window and the current one', () => {
    for (const period of DASHBOARD_PERIODS) {
      const current = windowFor(period, ANCHOR);
      const before = previousWindow(period, ANCHOR);
      const dayAfterPrevious = new Date(`${before.dateTo}T00:00:00Z`);
      dayAfterPrevious.setUTCDate(dayAfterPrevious.getUTCDate() + 1);
      assert.equal(dayAfterPrevious.toISOString().slice(0, 10), current.dateFrom, period);
    }
  });
});

describe('isCurrentPeriod', () => {
  it('is true only while the window contains the reference day', () => {
    assert.equal(isCurrentPeriod('monthly', ANCHOR, '2026-08-01'), true);
    assert.equal(isCurrentPeriod('monthly', ANCHOR, '2026-08-31'), true);
    assert.equal(isCurrentPeriod('monthly', ANCHOR, '2026-09-01'), false);
    assert.equal(isCurrentPeriod('daily', ANCHOR, '2026-08-18'), false);
    assert.equal(isCurrentPeriod('yearly', ANCHOR, '2026-12-31'), true);
    assert.equal(isCurrentPeriod('yearly', ANCHOR, '2027-01-01'), false);
  });
});
