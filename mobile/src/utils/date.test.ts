import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  dayOfInstant,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  formatShortDay,
  instantOfDay,
  monthGrid,
  parseDay,
  quarterOf,
  replaceDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from './date.ts';

/**
 * These are the windows every dashboard period is built from, so an off-by-one
 * here silently shifts which transactions a figure counts. 2026 is used
 * throughout: 2026-01-01 is a Thursday and 2026 is not a leap year, so the
 * month/week/quarter edges below are all real calendar dates, not invented ones.
 */

describe('startOfMonth / endOfMonth', () => {
  it('spans the whole month regardless of the day handed in', () => {
    assert.equal(startOfMonth('2026-08-17'), '2026-08-01');
    assert.equal(endOfMonth('2026-08-17'), '2026-08-31');
  });

  it('gets February right in a non-leap year', () => {
    assert.equal(endOfMonth('2026-02-10'), '2026-02-28');
  });

  it('gets February right in a leap year', () => {
    assert.equal(endOfMonth('2024-02-10'), '2024-02-29');
  });
});

describe('addMonths', () => {
  it('crosses a year boundary in both directions', () => {
    assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
    assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
  });

  it('clamps to the last day of a shorter target month rather than overflowing', () => {
    // Naive date math turns "Jan 31 + 1 month" into March 3rd.
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonths('2026-05-31', 1), '2026-06-30');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    assert.equal(addDays('2026-08-31', 1), '2026-09-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  });
});

describe('startOfWeek / endOfWeek', () => {
  it('runs Sunday to Saturday', () => {
    // 2026-08-17 is a Monday; its week is Sun 16th – Sat 22nd.
    assert.equal(startOfWeek('2026-08-17'), '2026-08-16');
    assert.equal(endOfWeek('2026-08-17'), '2026-08-22');
  });

  it('leaves a Sunday as its own week start', () => {
    assert.equal(startOfWeek('2026-08-16'), '2026-08-16');
  });

  it('keeps a Saturday in the week that already started', () => {
    assert.equal(startOfWeek('2026-08-22'), '2026-08-16');
    assert.equal(endOfWeek('2026-08-22'), '2026-08-22');
  });

  it('spans a month boundary without clamping to the month', () => {
    // Wed 2026-09-02's week starts back in August.
    assert.equal(startOfWeek('2026-09-02'), '2026-08-30');
    assert.equal(endOfWeek('2026-08-30'), '2026-09-05');
  });

  it('is always a 7-day inclusive window', () => {
    for (const day of ['2026-01-01', '2026-02-28', '2026-06-15', '2026-12-31']) {
      assert.equal(addDays(startOfWeek(day), 6), endOfWeek(day));
    }
  });
});

describe('addWeeks', () => {
  it('moves whole weeks, including across a year boundary', () => {
    assert.equal(addWeeks('2026-08-17', 1), '2026-08-24');
    assert.equal(addWeeks('2026-01-05', -1), '2025-12-29');
  });
});

describe('quarters', () => {
  it('numbers quarters 1-4 from the month', () => {
    assert.equal(quarterOf('2026-01-01'), 1);
    assert.equal(quarterOf('2026-03-31'), 1);
    assert.equal(quarterOf('2026-04-01'), 2);
    assert.equal(quarterOf('2026-09-30'), 3);
    assert.equal(quarterOf('2026-10-01'), 4);
    assert.equal(quarterOf('2026-12-31'), 4);
  });

  it('spans the full quarter from any day inside it', () => {
    assert.equal(startOfQuarter('2026-05-17'), '2026-04-01');
    assert.equal(endOfQuarter('2026-05-17'), '2026-06-30');
    assert.equal(startOfQuarter('2026-12-31'), '2026-10-01');
    assert.equal(endOfQuarter('2026-12-31'), '2026-12-31');
  });

  it('moves whole quarters, including across a year boundary', () => {
    assert.equal(addQuarters('2026-05-17', 1), '2026-07-01');
    assert.equal(addQuarters('2026-11-02', 1), '2027-01-01');
    assert.equal(addQuarters('2026-02-10', -1), '2025-10-01');
  });
});

describe('startOfYear / endOfYear', () => {
  it('spans the calendar year', () => {
    assert.equal(startOfYear('2026-08-17'), '2026-01-01');
    assert.equal(endOfYear('2026-08-17'), '2026-12-31');
  });
});

describe('parseDay', () => {
  it('reads a calendar day into its parts', () => {
    assert.deepEqual(parseDay('2026-08-17'), { year: 2026, month: 8, date: 17 });
  });

  it('falls back to today for input with no date shape at all', () => {
    const now = new Date();
    const expected = { year: now.getFullYear(), month: now.getMonth() + 1, date: now.getDate() };
    assert.deepEqual(parseDay('rubbish'), expected);
    assert.deepEqual(parseDay(null), expected);
    assert.deepEqual(parseDay(undefined), expected);
  });

  it('falls back per-part for dash-shaped but unparseable input', () => {
    // Dash-shaped input takes the split path, so each unreadable part falls
    // back on its own rather than the whole value reverting to today.
    assert.deepEqual(parseDay('x-y-z'), { year: 1970, month: 1, date: 1 });
  });
});

describe('instant conversion', () => {
  it('lands mid-day so a timezone shift cannot move the calendar day', () => {
    assert.equal(instantOfDay('2026-08-17'), '2026-08-17T12:00:00.000Z');
    assert.equal(dayOfInstant('2026-08-17T12:00:00.000Z'), '2026-08-17');
  });

  it('keeps the original time of day when only the date is corrected', () => {
    assert.equal(replaceDay('2026-08-17T08:45:00.000Z', '2026-09-02'), '2026-09-02T08:45:00.000Z');
  });
});

describe('monthGrid', () => {
  const grid = monthGrid('2026-08-17');

  it('is whole weeks of 7 real days', () => {
    for (const row of grid) assert.equal(row.length, 7);
    assert.equal(grid.flat().length % 7, 0);
  });

  it('pads with the adjacent months real days, flagged as outside', () => {
    const cells = grid.flat();
    const first = cells[0];
    const last = cells[cells.length - 1];
    assert.ok(first !== undefined && last !== undefined);
    // August 2026 starts on a Saturday, so the grid opens on July 26th.
    assert.equal(first.day, '2026-07-26');
    assert.equal(first.inCurrentMonth, false);
    assert.equal(last.inCurrentMonth, false);
    assert.equal(cells.filter((cell) => cell.inCurrentMonth).length, 31);
  });
});

describe('formatShortDay', () => {
  it('shows day and month only, in the locale order', () => {
    assert.equal(formatShortDay('2026-09-24', 'en'), 'Sep 24');
    assert.equal(formatShortDay('2026-09-24', 'vi'), '24 thg 9');
  });

  it('shows the actual date for today, not a relative word', () => {
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    assert.match(formatShortDay(day, 'en'), /^[A-Z][a-z]{2} \d{1,2}$/);
  });
});
