import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { goalDeadlinePresets } from './goalDeadlines.ts';

function daysOf(from: string) {
  return Object.fromEntries(goalDeadlinePresets(from).map(({ preset, day }) => [preset, day]));
}

describe('goalDeadlinePresets', () => {
  it('counts every preset from the given day', () => {
    assert.deepEqual(daysOf('2026-10-05'), {
      endOfThisMonth: '2026-10-31',
      in3Months: '2027-01-05',
      in6Months: '2027-04-05',
      endOfThisYear: '2026-12-31',
      in1Year: '2027-10-05',
      in2Years: '2028-10-05',
    });
  });

  it('clamps a month-end day to a shorter month', () => {
    const days = daysOf('2026-08-31');
    assert.equal(days.in6Months, '2027-02-28');
    assert.equal(days.in3Months, '2026-11-30');
    assert.equal(daysOf('2028-02-29').in1Year, '2029-02-28');
  });

  it('keeps only "end of this year" when it falls on the same day as "end of this month"', () => {
    const presets = goalDeadlinePresets('2026-12-05').map(({ preset }) => preset);
    assert.deepEqual(presets, ['in3Months', 'in6Months', 'endOfThisYear', 'in1Year', 'in2Years']);
  });

  it('never offers a day before the given one', () => {
    for (const from of ['2026-10-31', '2026-12-31', '2026-01-31']) {
      for (const { day } of goalDeadlinePresets(from)) assert.ok(day >= from, `${day} < ${from}`);
    }
  });
});
