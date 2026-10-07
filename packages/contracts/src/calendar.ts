/**
 * Wallet calendar time.
 *
 * An instant (an ISO timestamp, `TIMESTAMPTZ` in the database) is the same moment
 * everywhere. Which *day* it belongs to depends on where you stand, so every wallet
 * carries an IANA time zone and every wallet-level day, month, window and "today" is
 * read in that zone, for every member alike. This module is the one place an instant
 * becomes a calendar day, shared by the API and the app.
 *
 * Calendar days are `YYYY-MM-DD` strings with no zone of their own. Zone rules,
 * DST included, come from the runtime's tz database through `Intl` — never a fixed
 * offset.
 */

export type CalendarDay = string;

const ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * An IANA zone name the runtime knows. A fixed offset ("+07:00") is refused even where
 * `Intl` would accept it: it has no DST rules, so it is not a place's calendar.
 */
export function isTimeZone(value: string): boolean {
  if (!ZONE_NAME.test(value)) return false;
  try {
    formatterFor(value);
    return true;
  } catch {
    return false;
  }
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(epochMs: number, timeZone: string): WallClock {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    // Some engines still write midnight as 24 under hourCycle h23.
    hour: parts.hour! % 24,
    minute: parts.minute!,
    second: parts.second!,
  };
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

function dayOfWallClock(clock: WallClock): CalendarDay {
  return `${pad(clock.year, 4)}-${pad(clock.month)}-${pad(clock.day)}`;
}

function epochOf(instant: string | Date): number {
  const epoch = instant instanceof Date ? instant.getTime() : Date.parse(instant);
  if (Number.isNaN(epoch)) throw new RangeError(`Not an instant: ${String(instant)}`);
  return epoch;
}

/** The wallet calendar day an instant falls on: `2026-10-31T23:30:00Z` in Asia/Ho_Chi_Minh is `2026-11-01`. */
export function dayOfInstant(instant: string | Date, timeZone: string): CalendarDay {
  return dayOfWallClock(wallClock(epochOf(instant), timeZone));
}

/** Today in a wallet's zone, which can differ from today in UTC and on the viewer's device. */
export function todayIn(timeZone: string, now: Date = new Date()): CalendarDay {
  return dayOfInstant(now, timeZone);
}

/** The zone's offset from UTC at an instant, in ms (Asia/Ho_Chi_Minh: +7h). */
function offsetAt(epochMs: number, timeZone: string): number {
  const clock = wallClock(epochMs, timeZone);
  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second);
  return asUtc - (epochMs - (((epochMs % 1000) + 1000) % 1000));
}

/**
 * The instant a wall-clock time on `day` happens in `timeZone`. Through a DST gap the
 * skipped time resolves forward, as clocks do; in an overlap, the earlier instant.
 */
export function zonedInstant(day: CalendarDay, time: string, timeZone: string): Date {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const [hour = 0, minute = 0, seconds = 0] = time.split(':').map(Number);
  const wholeSeconds = Math.floor(seconds);
  const ms = Math.round((seconds - wholeSeconds) * 1000);
  const asUtc = Date.UTC(year, month - 1, date, hour, minute, wholeSeconds, ms);

  // The offsets a day either side bracket any transition on `day`; each gives one candidate.
  const candidates = [asUtc - offsetAt(asUtc - DAY_MS, timeZone), asUtc - offsetAt(asUtc + DAY_MS, timeZone)];
  const valid = candidates.filter((epoch) => offsetAt(epoch, timeZone) === asUtc - epoch);
  return new Date(valid.length > 0 ? Math.min(...valid) : Math.max(...candidates));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant `day` begins in `timeZone`, even where DST skips local midnight. */
export function startOfDay(day: CalendarDay, timeZone: string): Date {
  let start = zonedInstant(day, '00:00', timeZone);
  // A zone whose midnight is skipped resolves to the last instant of the day before; step to `day`.
  while (dayOfInstant(start, timeZone) < day) start = new Date(start.getTime() + 15 * 60 * 1000);
  return start;
}

/** The calendar day after `day`. Pure date arithmetic; no zone involved. */
export function nextDay(day: CalendarDay): CalendarDay {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * The half-open instant range `[start of dateFrom, start of the day after dateTo)` in
 * `timeZone`, for querying `TIMESTAMPTZ` columns by wallet calendar day.
 */
export function dayRange(dateFrom: CalendarDay, dateTo: CalendarDay, timeZone: string): { start: Date; end: Date } {
  return { start: startOfDay(dateFrom, timeZone), end: startOfDay(nextDay(dateTo), timeZone) };
}

/** The same wall-clock time as `instant`, moved to `day`, both read in `timeZone`. */
export function withDay(instant: string | Date, day: CalendarDay, timeZone: string): Date {
  const clock = wallClock(epochOf(instant), timeZone);
  const ms = epochOf(instant) % 1000;
  return zonedInstant(day, `${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}.${pad(ms, 3)}`, timeZone);
}
