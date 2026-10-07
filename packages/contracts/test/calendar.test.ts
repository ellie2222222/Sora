import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';

import {
  dayOfInstant,
  dayRange,
  isTimeZone,
  nextDay,
  startOfDay,
  todayIn,
  withDay,
  zonedInstant,
} from '../src/calendar.ts';
import { calculateBudgetSpent, countsAsPeriodActivity, isWithinPeriod, type SpendRelevantTransaction } from '../src/calc.ts';
import { TransactionStatus, TransactionType } from '../src/enums.ts';
import { parseMoney, formatMoneyCompact } from '../src/money.ts';
import { createWalletSchema, updateWalletSchema } from '../src/schemas.ts';

const VN = 'Asia/Ho_Chi_Minh';
const LA = 'America/Los_Angeles';
const NY = 'America/New_York';
const LONDON = 'Europe/London';

describe('dayOfInstant — Asia/Ho_Chi_Minh (UTC+7, no DST)', () => {
  it('files 2026-10-31T23:30Z under November 1, the regression case', () => {
    assert.equal(dayOfInstant('2026-10-31T23:30:00Z', VN), '2026-11-01');
  });

  it('keeps 23:59 local on October 31 in October', () => {
    assert.equal(dayOfInstant('2026-10-31T16:59:00Z', VN), '2026-10-31');
  });

  it('moves to November at 00:00 local and stays there through 06:59', () => {
    assert.equal(dayOfInstant('2026-10-31T17:00:00Z', VN), '2026-11-01');
    assert.equal(dayOfInstant('2026-10-31T23:59:00Z', VN), '2026-11-01');
  });

  it('does not change day when UTC crosses midnight', () => {
    assert.equal(dayOfInstant('2026-11-01T23:59:59Z', VN), '2026-11-02');
    assert.equal(dayOfInstant('2026-11-02T00:00:00Z', VN), '2026-11-02');
  });

  it('accepts an instant written with its own offset', () => {
    assert.equal(dayOfInstant('2026-11-01T06:30:00+07:00', VN), '2026-11-01');
  });
});

describe('dayOfInstant — negative offset and DST', () => {
  it('reads America/Los_Angeles behind UTC: 03:00Z on Nov 1 is still Oct 31', () => {
    assert.equal(dayOfInstant('2026-11-01T03:00:00Z', LA), '2026-10-31');
    assert.equal(dayOfInstant('2026-11-01T07:00:00Z', LA), '2026-11-01');
  });

  it('follows New York across the March 8, 2026 spring-forward', () => {
    // Before: EST (UTC-5), after 02:00 local: EDT (UTC-4).
    assert.equal(dayOfInstant('2026-03-08T04:59:00Z', NY), '2026-03-07');
    assert.equal(dayOfInstant('2026-03-08T05:00:00Z', NY), '2026-03-08');
    assert.equal(dayOfInstant('2026-03-09T03:59:00Z', NY), '2026-03-08');
    assert.equal(dayOfInstant('2026-03-09T04:00:00Z', NY), '2026-03-09');
  });
});

describe('startOfDay and dayRange', () => {
  it('starts a Vietnamese day at 17:00Z the day before', () => {
    assert.equal(startOfDay('2026-11-01', VN).toISOString(), '2026-10-31T17:00:00.000Z');
  });

  it('starts a Los Angeles day after UTC midnight', () => {
    assert.equal(startOfDay('2026-11-01', LA).toISOString(), '2026-11-01T07:00:00.000Z');
  });

  it('makes a DST day 23 or 25 hours long, not 24', () => {
    const spring = dayRange('2026-03-08', '2026-03-08', NY);
    assert.equal((spring.end.getTime() - spring.start.getTime()) / 3_600_000, 23);
    const autumn = dayRange('2026-11-01', '2026-11-01', NY);
    assert.equal((autumn.end.getTime() - autumn.start.getTime()) / 3_600_000, 25);
  });

  it('is half-open: [start of dateFrom, start of the day after dateTo)', () => {
    const { start, end } = dayRange('2026-11-01', '2026-11-30', VN);
    assert.equal(start.toISOString(), '2026-10-31T17:00:00.000Z');
    assert.equal(end.toISOString(), '2026-11-30T17:00:00.000Z');
    assert.equal(nextDay('2026-12-31'), '2027-01-01');
  });
});

describe('zonedInstant and withDay (the date picker)', () => {
  it('builds the instant of a wall-clock time in the zone', () => {
    assert.equal(zonedInstant('2026-11-01', '06:30', VN).toISOString(), '2026-10-31T23:30:00.000Z');
    assert.equal(zonedInstant('2026-11-01', '12:00', LA).toISOString(), '2026-11-01T20:00:00.000Z');
  });

  it('resolves a time skipped by spring-forward forward, and an ambiguous one to the earlier instant', () => {
    assert.equal(zonedInstant('2026-03-08', '02:30', NY).toISOString(), '2026-03-08T07:30:00.000Z');
    assert.equal(zonedInstant('2026-11-01', '01:30', NY).toISOString(), '2026-11-01T05:30:00.000Z');
    assert.equal(zonedInstant('2026-10-25', '01:30', LONDON).toISOString(), '2026-10-25T00:30:00.000Z');
  });

  it('moves an instant to another wallet day without shifting its local time or day', () => {
    // 06:30 local on Nov 1 picked onto Nov 3 stays 06:30 local, on Nov 3.
    const moved = withDay('2026-10-31T23:30:00.000Z', '2026-11-03', VN);
    assert.equal(moved.toISOString(), '2026-11-02T23:30:00.000Z');
    assert.equal(dayOfInstant(moved, VN), '2026-11-03');
  });

  it('keeps the local time across a DST change', () => {
    const moved = withDay('2026-03-07T14:15:00.000Z', '2026-03-09', NY);
    assert.equal(moved.toISOString(), '2026-03-09T13:15:00.000Z');
  });
});

describe('todayIn', () => {
  it('is the wallet zone\'s date, not UTC\'s', () => {
    const now = new Date('2026-10-31T23:30:00Z');
    assert.equal(todayIn(VN, now), '2026-11-01');
    assert.equal(todayIn('UTC', now), '2026-10-31');
    assert.equal(todayIn(LA, now), '2026-10-31');
  });
});

describe('isTimeZone and timeZoneSchema', () => {
  it('accepts IANA names and refuses offsets, abbreviations and unknown names', () => {
    for (const zone of [VN, LA, 'Asia/Tokyo', LONDON, 'UTC']) assert.equal(isTimeZone(zone), true, zone);
    for (const zone of ['+07:00', 'UTC+7', 'GMT+7', 'Vietnam/Hanoi', '', 'Asia/']) assert.equal(isTimeZone(zone), false, zone);
  });

  it('is required to create a wallet and optional to update one', () => {
    assert.equal(createWalletSchema.safeParse({ name: 'Mom' }).success, false);
    assert.equal(createWalletSchema.safeParse({ name: 'Mom', timeZone: '+07:00' }).success, false);
    assert.equal(createWalletSchema.safeParse({ name: 'Mom', timeZone: VN }).success, true);
    assert.equal(updateWalletSchema.safeParse({ timeZone: LA }).success, true);
  });
});

describe('wallet-zone budgets and periods (API spec §12.2)', () => {
  const november = { walletId: 'w1', categoryId: null, categoryIds: [], goalId: null, currency: 'VND', startDate: '2026-11-01', endDate: '2026-11-30', timeZone: VN };
  const expense = (transactionDate: string): SpendRelevantTransaction => ({
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('1000'),
    currency: 'VND',
    categoryId: 'food',
    goalId: null,
    walletId: 'w1',
    transactionDate,
  });

  it('counts 23:30 local on Nov 30 (16:30Z) toward November', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(november, [expense('2026-11-30T16:30:00Z')])), '1000');
  });

  it('leaves 00:30 local on Dec 1 (17:30Z on Nov 30) out of November', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(november, [expense('2026-11-30T17:30:00Z')])), '0');
  });

  it('counts 06:30 local on Nov 1 (23:30Z on Oct 31) toward November, and the same instant is October in Los Angeles', () => {
    assert.equal(isWithinPeriod('2026-10-31T23:30:00Z', '2026-11-01', '2026-11-30', VN), true);
    assert.equal(isWithinPeriod('2026-10-31T23:30:00Z', '2026-11-01', '2026-11-30', LA), false);
  });

  it('files dashboard period activity by the wallet zone too', () => {
    const row = { type: TransactionType.EXPENSE, status: TransactionStatus.COMPLETED, transactionDate: '2026-10-31T23:30:00Z' };
    assert.equal(countsAsPeriodActivity(row, '2026-11-01', '2026-11-30', VN), true);
    assert.equal(countsAsPeriodActivity(row, '2026-10-01', '2026-10-31', VN), false);
  });
});

describe('shared wallet: members whose devices sit in different zones', () => {
  const savedTz = process.env.TZ;
  afterEach(() => {
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('computes the same wallet days and budget totals whatever the device zone', () => {
    const results = ['Asia/Ho_Chi_Minh', 'Asia/Tokyo', 'America/Los_Angeles'].map((deviceZone) => {
      process.env.TZ = deviceZone;
      return [
        dayOfInstant('2026-10-31T23:30:00Z', VN),
        startOfDay('2026-11-01', VN).toISOString(),
        isWithinPeriod('2026-11-30T17:30:00Z', '2026-11-01', '2026-11-30', VN),
      ];
    });
    assert.deepEqual(results[1], results[0]);
    assert.deepEqual(results[2], results[0]);
    assert.deepEqual(results[0], ['2026-11-01', '2026-10-31T17:00:00.000Z', false]);
  });
});
