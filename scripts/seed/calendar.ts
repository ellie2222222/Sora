// The anchor and every date rule of the plan's §1.5. Calendar days are YYYY-MM-DD with no zone; an
// instant is only ever built through @sora/contracts' zonedInstant, never a hand-written offset.

import { startOfDay, todayIn, zonedInstant } from '@sora/contracts';

export const HOME_ZONE = 'Asia/Ho_Chi_Minh';

/** Lunar New Year (day 1 of month 1), Vietnam. A dry run refuses an anchor this can't cover. */
export const TET = ['2025-01-29', '2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03', '2031-01-23'] as const;

const DAY_MS = 86_400_000;
const SYNODIC_MONTH_DAYS = 29.530588853;

const epochDay = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY_MS;
const fromEpochDay = (value: number) => new Date(value * DAY_MS).toISOString().slice(0, 10);

export const addDays = (day: string, days: number) => fromEpochDay(epochDay(day) + days);
export const monthOf = (day: string) => day.slice(0, 7);
export const firstOfMonth = (day: string) => `${day.slice(0, 8)}01`;
/** 0 = Sunday … 6 = Saturday. */
export const weekday = (day: string) => new Date(epochDay(day) * DAY_MS).getUTCDay();
export const isLastDayOfMonth = (day: string) => addDays(day, 1).endsWith('-01');

const daysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/** `day` moved `months` calendar months, clamped to a shorter month's last day (Jan 31 → Feb 28). */
export function addMonths(day: string, months: number): string {
  const total = Number(day.slice(5, 7)) - 1 + months;
  const year = Number(day.slice(0, 4)) + Math.floor(total / 12);
  const monthIndex = ((total % 12) + 12) % 12;
  const date = Math.min(Number(day.slice(8, 10)), daysInMonth(year, monthIndex));
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

/** The last day on or before `day` with the given weekday. */
export function onOrBefore(day: string, target: number): string {
  return addDays(day, -((weekday(day) - target + 7) % 7));
}

export function onOrAfter(day: string, target: number): string {
  return addDays(day, (target - weekday(day) + 7) % 7);
}

/** A weekend day moved back to the Friday before it (salary and bonus days). */
export function previousWorkday(day: string): string {
  const dow = weekday(day);
  return dow === 6 ? addDays(day, -1) : dow === 0 ? addDays(day, -2) : day;
}

export function dayList(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export function instantOf(day: string, time: string, timeZone: string): string {
  return zonedInstant(day, time, timeZone).toISOString();
}

/** Days in `timeZone` that aren't 24 hours long: the daylight-saving changes. */
export function daylightSavingDays(from: string, to: string, timeZone: string): string[] {
  return dayList(from, to).filter(
    (day) => startOfDay(addDays(day, 1), timeZone).getTime() - startOfDay(day, timeZone).getTime() !== DAY_MS,
  );
}

/**
 * Lunar days 1 and 15 (Temple Offering), approximated by stepping the mean synodic month from the Tet
 * before: within a day of the true dates, which is all a recurring offering needs.
 */
export function lunarOfferingDays(from: string, to: string): Set<string> {
  const days = new Set<string>();
  for (const tet of TET) {
    for (let month = 0; month < 13; month++) {
      const first = fromEpochDay(Math.round(epochDay(tet) + month * SYNODIC_MONTH_DAYS));
      for (const day of [first, addDays(first, 14)]) if (day >= from && day <= to) days.add(day);
    }
  }
  return days;
}

export class AnchorError extends Error {}

export interface StoryDates {
  anchor: string;
  /** History runs H0 … A − 1; nothing COMPLETED is dated on A. */
  historyStart: string;
  historyEnd: string;
  /** The first Monday on or after H0: weekly budgets start here. */
  firstMonday: string;
  /** Yearly budgets start at A − 10 months, so A sits ten months into the current period. */
  yearlyStart: string;
  /** Bills starts on the first month-end of 31 days from H0, to exercise a shorter month's last day. */
  billsStart: string;
  tet: string;
  tetBonus: string;
  /** The first Tet whose 30-day Next Tet window starts after A. */
  nextTet: string;
  sale: { start: string; end: string; blackFriday: string; elevenEleven: string; twelveTwelve: string };
  dalatFriday: string;
  hospital: string;
  motorbikeService: string;
  japan: { transfer: string; flights: string; jrPass: string; exchange: string; departs: string; returns: string; hotelHold: string };
  courses: [string, string];
  motorbike: { firstPayment: string; removedPayment: string; finalPayment: string };
  guitarCancelled: string;
  birthdayGift: string;
  /** The month whose Rent is booked at 00:10 on the 1st, 17:10Z the day before. */
  midnightRentMonth: string;
  lastSunday: string;
  lastSaturday: string;
  /** Where "at the anchor" readings are taken: A, or A − 1 when A is the 1st and its month has no rows yet. */
  readingDay: string;
}

export function resolveAnchor(override: string | undefined): string {
  if (override === undefined || override === '') return todayIn(HOME_ZONE);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(override) || fromEpochDay(epochDay(override)) !== override) {
    throw new AnchorError(`SEED_ANCHOR must be a real YYYY-MM-DD day, got "${override}"`);
  }
  return override;
}

export function storyDates(anchor: string): StoryDates {
  const historyEnd = addDays(anchor, -1);
  const departs = addDays(anchor, -4);

  // The most recent Tet whose cluster (Tet − 12 … Tet + 4) ends at least 9 days before A, clear of the trip.
  const tet = [...TET].reverse().find((day) => addDays(day, 4) <= addDays(anchor, -9));
  if (!tet) throw new AnchorError(`No Tet in the table (${TET.join(', ')}) ends at least 9 days before ${anchor}`);
  const nextTet = TET.find((day) => addDays(day, -29) > anchor);
  if (!nextTet) throw new AnchorError(`No Tet in the table (${TET.join(', ')}) has a 30-day window starting after ${anchor}`);

  // The most recent complete 11.11 → 12.12 window (Nov 1 → Dec 15) ending before A.
  const saleYear = `${anchor.slice(0, 4)}-12-15` < anchor ? Number(anchor.slice(0, 4)) : Number(anchor.slice(0, 4)) - 1;
  const sale = {
    start: `${saleYear}-11-01`,
    end: `${saleYear}-12-15`,
    elevenEleven: `${saleYear}-11-11`,
    blackFriday: onOrBefore(`${saleYear}-11-30`, 5),
    twelveTwelve: `${saleYear}-12-12`,
  };

  // The most recent June trip (2nd Friday, booked two weeks ahead, settled three days after) clear of Japan.
  let juneYear = Number(anchor.slice(0, 4));
  while (addDays(onOrAfter(`${juneYear}-06-08`, 5), 3) >= departs) juneYear -= 1;
  const dalatFriday = onOrAfter(`${juneYear}-06-08`, 5);

  const historyStart = [addMonths(firstOfMonth(anchor), -12), firstOfMonth(addDays(tet, -12)), sale.start, firstOfMonth(addDays(dalatFriday, -14))].sort()[0]!;

  let billsStart = historyStart;
  for (let month = 0; month < 12; month++) {
    const first = addMonths(historyStart, month);
    if (daysInMonth(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1) === 31) {
      billsStart = `${first.slice(0, 8)}31`;
      break;
    }
  }

  const dates: StoryDates = {
    anchor,
    historyStart,
    historyEnd,
    firstMonday: onOrAfter(historyStart, 1),
    yearlyStart: addMonths(anchor, -10),
    billsStart,
    tet,
    tetBonus: previousWorkday(addDays(tet, -10)),
    nextTet,
    sale,
    dalatFriday,
    hospital: addMonths(anchor, -6),
    motorbikeService: addMonths(anchor, -2),
    japan: {
      transfer: addDays(anchor, -63),
      flights: addDays(anchor, -56),
      jrPass: addDays(anchor, -42),
      exchange: addDays(anchor, -7),
      departs,
      returns: addDays(anchor, 3),
      hotelHold: addDays(anchor, -2),
    },
    courses: [addMonths(anchor, -7), addMonths(anchor, -3)],
    motorbike: {
      firstPayment: addMonths(anchor, -6),
      removedPayment: addMonths(anchor, -5),
      finalPayment: addDays(addMonths(anchor, -4), -7),
    },
    guitarCancelled: addMonths(anchor, -3),
    birthdayGift: addDays(addMonths(anchor, -7), 12),
    midnightRentMonth: monthOf(addMonths(historyStart, 5)),
    lastSunday: onOrBefore(anchor, 0),
    lastSaturday: onOrBefore(anchor, 6),
    readingDay: anchor.endsWith('-01') ? historyEnd : anchor,
  };

  const mustBeInHistory: [string, string][] = [
    ['Tet bonus', dates.tetBonus],
    ['hospital visit', dates.hospital],
    ['first course', dates.courses[0]],
  ];
  for (const [name, day] of mustBeInHistory) {
    if (day < historyStart || day > historyEnd) throw new AnchorError(`${name} (${day}) falls outside the history ${historyStart} … ${historyEnd}`);
  }
  return dates;
}
