import { strict as assert } from 'node:assert';
import { after, describe, it } from 'node:test';
import i18next from 'i18next';

import en from '../app/i18n/locales/en.ts';
import vi from '../app/i18n/locales/vi.ts';
import {
  DASHBOARD_PERIODS,
  formatPeriodLabel,
  isCurrentPeriod,
  previousWindow,
  shiftAnchor,
  windowFor,
} from './dashboardPeriod.ts';

// formatPeriodLabel takes no locale argument; it reads the app-wide i18next language.
await i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, vi: { translation: vi } },
  interpolation: { escapeValue: false },
});

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

describe('formatPeriodLabel', () => {
  after(async () => {
    await i18next.changeLanguage('en');
  });

  it('labels each period in English', async () => {
    await i18next.changeLanguage('en');
    assert.equal(formatPeriodLabel('daily', ANCHOR), 'Aug 17, 2026');
    assert.equal(formatPeriodLabel('weekly', ANCHOR), 'Aug 16, 2026 – Aug 22, 2026');
    assert.equal(formatPeriodLabel('monthly', ANCHOR), 'Aug 2026');
    assert.equal(formatPeriodLabel('quarterly', ANCHOR), 'Q3 2026');
    assert.equal(formatPeriodLabel('yearly', ANCHOR), '2026');
  });

  it('labels a week that spans New Year with both years', async () => {
    await i18next.changeLanguage('en');
    assert.equal(formatPeriodLabel('weekly', '2026-12-30'), 'Dec 27, 2026 – Jan 2, 2027');
  });

  it('follows the active language for the date-based periods', async () => {
    await i18next.changeLanguage('vi');
    assert.equal(formatPeriodLabel('daily', ANCHOR), '17 thg 8, 2026');
    assert.equal(formatPeriodLabel('weekly', ANCHOR), '16 thg 8, 2026 – 22 thg 8, 2026');
    assert.equal(formatPeriodLabel('monthly', ANCHOR), 'thg 8 2026');
  });
});
