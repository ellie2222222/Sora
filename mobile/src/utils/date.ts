/**
 * Calendar helpers.
 *
 * Budget windows and dashboard periods are compared by calendar day, never by
 * instant (API spec §2.3), so the app's day strings are produced the same way
 * the server compares them: the first ten characters, in local time for
 * "today" and verbatim for anything that arrived as a date already.
 */

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

export function parseDay(day: CalendarDay): { year: number; month: number; date: number } {
  const [year = '1970', month = '01', date = '01'] = day.split('-');
  return { year: Number(year), month: Number(month), date: Number(date) };
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

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

export function formatDay(day: CalendarDay): string {
  const { year, month, date } = parseDay(day);
  return `${date} ${monthName(month)} ${year}`;
}

export function formatMonthYear(day: CalendarDay): string {
  const { year, month } = parseDay(day);
  return `${monthName(month)} ${year}`;
}

/** "Today" / "Yesterday" / "22 Aug 2026" — the transaction list's day headers. */
export function formatDayHeading(day: CalendarDay, reference: CalendarDay = today()): string {
  if (day === reference) return 'Today';
  if (day === addDays(reference, -1)) return 'Yesterday';
  const { year, month, date } = parseDay(day);
  const weekday = WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, date)).getUTCDay()] ?? '';
  const sameYear = parseDay(reference).year === year;
  return sameYear
    ? `${weekday}, ${date} ${monthName(month)}`
    : `${weekday}, ${date} ${monthName(month)} ${year}`;
}

export function formatTimeOfDay(instant: Instant): string {
  const parsed = new Date(instant);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/**
 * A month laid out as calendar rows, `null` padding the leading and trailing
 * blanks, so the picker renders a grid without arithmetic in the component.
 */
export function monthGrid(day: CalendarDay): (CalendarDay | null)[][] {
  const { year, month } = parseDay(day);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (CalendarDay | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let date = 1; date <= lastDate; date += 1) {
    cells.push(`${year}-${pad(month)}-${pad(date)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (CalendarDay | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}
