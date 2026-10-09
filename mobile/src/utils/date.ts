/**
 * Calendar helpers.
 *
 * A wallet's days, months, windows and "today" are read in the wallet's own time
 * zone (API spec §2.11), never UTC and never this device's, so every member sees the
 * same figures. Turning an instant into a wallet day goes through `@sora/contracts`'
 * calendar functions, the same code the API runs. The arithmetic below works on
 * `YYYY-MM-DD` strings and involves no zone.
 */

import i18next from 'i18next';

import { dayOfInstant, isTimeZone, todayIn, withDay, zonedInstant, type CalendarDay } from '@sora/contracts';

export { dayOfInstant, type CalendarDay };
export type Instant = string;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** A `Date`'s day on this device — for display only, never for wallet maths. */
export function dayOfDate(date: Date): CalendarDay {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The zone this device is set to, only ever a default for a new wallet. */
export function deviceTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && isTimeZone(zone) ? zone : 'UTC';
}

/** Today in the wallet's zone. */
export function today(timeZone: string): CalendarDay {
  return todayIn(timeZone);
}

export function nowInstant(): Instant {
  return new Date().toISOString();
}

/** Midday on `day` in the wallet's zone: the instant a date-only entry (a contribution) is stamped with. */
export function middayOf(day: CalendarDay, timeZone: string): Instant {
  return zonedInstant(day, '12:00', timeZone).toISOString();
}

/**
 * Move an instant to another wallet day, keeping its wall-clock time there.
 *
 * Correcting the date on a record should not silently restamp the clock time it
 * was recorded at, nor land it on the day before or after in the wallet's zone.
 */
export function replaceDay(instant: Instant, day: CalendarDay, timeZone: string): Instant {
  return withDay(instant, day, timeZone).toISOString();
}

export function parseDay(day?: CalendarDay | null): { year: number; month: number; date: number } {
  if (!day || typeof day !== 'string' || !day.includes('-')) {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, date: d.getDate() };
  }
  const [year = '1970', month = '01', date = '01'] = day.split('-');
  return { year: Number(year) || 1970, month: Number(month) || 1, date: Number(date) || 1 };
}

export function startOfMonth(day: CalendarDay): CalendarDay {
  const { year, month } = parseDay(day);
  return `${year}-${pad(month)}-01`;
}

export function endOfMonth(day: CalendarDay): CalendarDay {
  const { year, month } = parseDay(day);
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(lastDate)}`;
}

export function addMonths(day: CalendarDay, delta: number): CalendarDay {
  const { year, month, date } = parseDay(day);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  const lastDate = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    Math.min(date, lastDate),
  )}`;
}

/** The same month and day in `year`, clamped: Feb 29 lands on Feb 28 in a non-leap year. */
export function withYear(day: CalendarDay, year: number): CalendarDay {
  return addMonths(day, (year - parseDay(day).year) * 12);
}

export function addDays(day: CalendarDay, delta: number): CalendarDay {
  const { year, month, date } = parseDay(day);
  const shifted = new Date(Date.UTC(year, month - 1, date + delta));
  return dayOfDate(
    new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
  );
}

/**
 * Weeks run Sunday–Saturday, matching `monthGrid`'s own layout —
 * the picker grid and a "this week" dashboard period must not disagree about
 * which day a week starts on.
 */
export function startOfWeek(day: CalendarDay): CalendarDay {
  const { year, month, date } = parseDay(day);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return addDays(day, -weekday);
}

export function endOfWeek(day: CalendarDay): CalendarDay {
  return addDays(startOfWeek(day), 6);
}

export function addWeeks(day: CalendarDay, delta: number): CalendarDay {
  return addDays(day, delta * 7);
}

/** 1-4, calendar quarters. */
export function quarterOf(day: CalendarDay): number {
  return Math.floor((parseDay(day).month - 1) / 3) + 1;
}

export function startOfQuarter(day: CalendarDay): CalendarDay {
  const { year } = parseDay(day);
  return `${year}-${pad((quarterOf(day) - 1) * 3 + 1)}-01`;
}

export function endOfQuarter(day: CalendarDay): CalendarDay {
  return endOfMonth(addMonths(startOfQuarter(day), 2));
}

export function addQuarters(day: CalendarDay, delta: number): CalendarDay {
  return startOfQuarter(addMonths(startOfQuarter(day), delta * 3));
}

export function startOfYear(day: CalendarDay): CalendarDay {
  return `${parseDay(day).year}-01-01`;
}

export function endOfYear(day: CalendarDay): CalendarDay {
  return `${parseDay(day).year}-12-31`;
}

/** Vietnamese's abbreviated month ("thg 10") reads as clipped and saves only two letters over "tháng 10". */
function monthStyle(locale: string): 'short' | 'long' {
  return locale.startsWith('vi') ? 'long' : 'short';
}

function clampMonth(month: number): number {
  return Math.max(1, Math.min(12, Number(month) || 1));
}

function formatMonth(month: number, locale: string, style: 'short' | 'long' | 'numeric'): string {
  return new Date(Date.UTC(2026, clampMonth(month) - 1, 15)).toLocaleDateString(locale, { month: style, timeZone: 'UTC' });
}

export function monthName(month: number, locale: string = i18next.language || 'en'): string {
  return formatMonth(month, locale, monthStyle(locale));
}

/**
 * A month as one of twelve axis ticks sharing a phone's width: the short name without its trailing
 * abbreviation mark ("февр." → "февр"), and Vietnamese, whose short form is still "tháng 10", as a number.
 */
export function monthTick(month: number, locale: string = i18next.language || 'en'): string {
  if (locale.startsWith('vi')) return formatMonth(month, locale, 'numeric');
  return formatMonth(month, locale, 'short').replace(/[.॰]$/u, '');
}

export function formatDay(day: CalendarDay, locale: string = i18next.language || 'en'): string {
  if (!day || typeof day !== 'string') return '';
  const { year, month, date } = parseDay(day);
  const d = new Date(Date.UTC(year, month - 1, date));
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(locale, { day: 'numeric', month: monthStyle(locale), year: 'numeric', timeZone: 'UTC' });
}

/** Day and month only ("Sep 24", "24 tháng 9") — for controls too narrow for `formatDay`. */
export function formatShortDay(day: CalendarDay, locale: string = i18next.language || 'en'): string {
  if (!day || typeof day !== 'string') return '';
  const { year, month, date } = parseDay(day);
  const d = new Date(Date.UTC(year, month - 1, date));
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(locale, { day: 'numeric', month: monthStyle(locale), timeZone: 'UTC' });
}

export function formatMonthYear(day: CalendarDay, locale: string = i18next.language || 'en'): string {
  if (!day || typeof day !== 'string') return '';
  const { year, month } = parseDay(day);
  const d = new Date(Date.UTC(year, month - 1, 15));
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(locale, { month: monthStyle(locale), year: 'numeric', timeZone: 'UTC' });
}

/** "Today" / "Yesterday" / "22 Aug 2026" — the transaction list's day headers. */
export function formatDayHeading(
  day: CalendarDay,
  reference: CalendarDay,
  locale: string = i18next.language || 'en',
): string {
  if (!day || typeof day !== 'string') return '';

  const { year, month, date } = parseDay(day);
  const d = new Date(Date.UTC(year, month - 1, date));
  if (Number.isNaN(d.getTime())) return day;
  const sameYear = parseDay(reference).year === year;

  const formattedDate = d.toLocaleDateString(
    locale,
    sameYear
      ? { day: 'numeric', month: monthStyle(locale), timeZone: 'UTC' }
      : { day: 'numeric', month: monthStyle(locale), year: 'numeric', timeZone: 'UTC' },
  );

  if (day === reference) {
    return `${i18next.t('common.today')} · ${formattedDate}`;
  }
  if (day === addDays(reference, -1)) {
    return `${i18next.t('common.yesterday')} · ${formattedDate}`;
  }

  return d.toLocaleDateString(
    locale,
    sameYear
      ? { weekday: 'short', month: monthStyle(locale), day: 'numeric', timeZone: 'UTC' }
      : { weekday: 'short', month: monthStyle(locale), day: 'numeric', year: 'numeric', timeZone: 'UTC' },
  );
}

export function formatTimeOfDay(instant: Instant): string {
  const parsed = new Date(instant);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** `14:32` today, `Sep 24 14:32` on any other day, both in local time. */
export function formatSavedAt(instant: Instant, locale: string = i18next.language || 'en', now: Date = new Date()): string {
  const parsed = new Date(instant);
  if (Number.isNaN(parsed.getTime())) return '';
  const time = formatTimeOfDay(instant);
  const day = dayOfDate(parsed);
  return day === dayOfDate(now) ? time : `${formatShortDay(day, locale)} ${time}`;
}

export interface MonthGridCell {
  day: CalendarDay;
  /** False for the previous/next month's overflow days padding the grid to full weeks. */
  inCurrentMonth: boolean;
}

/**
 * A month laid out as calendar rows, padded to full weeks with the real
 * adjacent-month days (not blanks) — the picker's grid is a continuous
 * calendar window, and every cell (including the overflow) must be a real,
 * tappable day so tapping one can jump the picker straight into that month.
 */
export function monthGrid(day: CalendarDay): MonthGridCell[][] {
  const { year, month } = parseDay(day);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart: CalendarDay = `${year}-${pad(month)}-01`;

  const cells: MonthGridCell[] = [];
  for (let offset = firstWeekday; offset > 0; offset -= 1) {
    cells.push({ day: addDays(monthStart, -offset), inCurrentMonth: false });
  }
  for (let date = 1; date <= lastDate; date += 1) {
    cells.push({ day: `${year}-${pad(month)}-${pad(date)}`, inCurrentMonth: true });
  }
  for (let offset = 1; cells.length % 7 !== 0; offset += 1) {
    cells.push({ day: addDays(monthStart, lastDate - 1 + offset), inCurrentMonth: false });
  }

  const rows: MonthGridCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}
