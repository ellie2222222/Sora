/**
 * Calendar helpers.
 *
 * Budget windows and dashboard periods are compared by calendar day, never by
 * instant (API spec §2.3), so the app's day strings are produced the same way
 * the server compares them: the first ten characters, in local time for
 * "today" and verbatim for anything that arrived as a date already.
 */

import i18next from 'i18next';

export type CalendarDay = string;
export type Instant = string;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function dayOfDate(date: Date): CalendarDay {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today(): CalendarDay {
  return dayOfDate(new Date());
}

export function nowInstant(): Instant {
  return new Date().toISOString();
}

/** The calendar day an instant belongs to, as the API compares it. */
export function dayOfInstant(instant: Instant): CalendarDay {
  return instant.slice(0, 10);
}

/** Midday rather than midnight, so a timezone shift cannot move the day. */
export function instantOfDay(day: CalendarDay): Instant {
  return new Date(`${day}T12:00:00Z`).toISOString();
}

/**
 * Move an instant to another calendar day, keeping its time of day.
 *
 * Correcting the date on a record should not silently restamp the clock time it
 * was recorded at, which is what rebuilding it through `instantOfDay` would do.
 */
export function replaceDay(instant: Instant, day: CalendarDay): Instant {
  return `${day}${instant.slice(10)}`;
}

export function parseDay(day?: CalendarDay | null): { year: number; month: number; date: number } {
  if (!day || typeof day !== 'string' || !day.includes('-')) {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, date: d.getDate() };
  }
  const [year = '1970', month = '01', date = '01'] = day.split('-');
  return { year: Number(year) || 1970, month: Number(month) || 1, date: Number(date) || 1 };
}

export function startOfMonth(day: CalendarDay = today()): CalendarDay {
  const { year, month } = parseDay(day);
  return `${year}-${pad(month)}-01`;
}

export function endOfMonth(day: CalendarDay = today()): CalendarDay {
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

export function addDays(day: CalendarDay, delta: number): CalendarDay {
  const { year, month, date } = parseDay(day);
  const shifted = new Date(Date.UTC(year, month - 1, date + delta));
  return dayOfDate(
    new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
  );
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export function monthName(month: number, locale: string = i18next.language || 'en'): string {
  const validMonth = Math.max(1, Math.min(12, Number(month) || 1));
  const date = new Date(Date.UTC(2026, validMonth - 1, 15));
  return date.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' });
}

export function formatDay(day: CalendarDay, locale: string = i18next.language || 'en'): string {
  if (!day || typeof day !== 'string') return '';
  const { year, month, date } = parseDay(day);
  const d = new Date(Date.UTC(year, month - 1, date));
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatMonthYear(day: CalendarDay, locale: string = i18next.language || 'en'): string {
  if (!day || typeof day !== 'string') return '';
  const { year, month } = parseDay(day);
  const d = new Date(Date.UTC(year, month - 1, 15));
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "Today" / "Yesterday" / "22 Aug 2026" — the transaction list's day headers. */
export function formatDayHeading(
  day: CalendarDay,
  reference: CalendarDay = today(),
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
      ? { day: 'numeric', month: 'short', timeZone: 'UTC' }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  );

  if (day === reference) {
    const todayLabel = i18next.t('common.today', { defaultValue: 'Today' });
    return `${todayLabel} · ${formattedDate}`;
  }
  if (day === addDays(reference, -1)) {
    const yesterdayLabel = i18next.t('common.yesterday', { defaultValue: 'Yesterday' });
    return `${yesterdayLabel} · ${formattedDate}`;
  }

  return d.toLocaleDateString(
    locale,
    sameYear
      ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
      : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  );
}

export function formatTimeOfDay(instant: Instant): string {
  const parsed = new Date(instant);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
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
