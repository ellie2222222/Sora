/**
 * The dashboard's period windows.
 *
 * Every period the dashboard offers is expressed as one `[dateFrom, dateTo]`
 * calendar-day window plus the window immediately before it, because the
 * endpoint takes free-form dates (`dashboardQuerySchema`) and places no
 * monthly/yearly assumption on them — the granularity lives entirely in what
 * the app asks for.
 */

import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  formatDay,
  formatMonthYear,
  parseDay,
  quarterOf,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  today,
  type CalendarDay,
} from './date.ts';

export const DASHBOARD_PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export interface PeriodWindow {
  dateFrom: CalendarDay;
  dateTo: CalendarDay;
}

/** The window containing `anchor`, aligned to the period's own calendar boundaries. */
export function windowFor(period: DashboardPeriod, anchor: CalendarDay): PeriodWindow {
  switch (period) {
    case 'daily':
      return { dateFrom: anchor, dateTo: anchor };
    case 'weekly':
      return { dateFrom: startOfWeek(anchor), dateTo: endOfWeek(anchor) };
    case 'quarterly':
      return { dateFrom: startOfQuarter(anchor), dateTo: endOfQuarter(anchor) };
    case 'yearly':
      return { dateFrom: startOfYear(anchor), dateTo: endOfYear(anchor) };
    case 'monthly':
    default:
      return { dateFrom: startOfMonth(anchor), dateTo: endOfMonth(anchor) };
  }
}

/** Move the anchor whole periods at a time — the ← / → controls. */
export function shiftAnchor(period: DashboardPeriod, anchor: CalendarDay, delta: number): CalendarDay {
  switch (period) {
    case 'daily':
      return addDays(anchor, delta);
    case 'weekly':
      return addWeeks(anchor, delta);
    case 'quarterly':
      return addQuarters(anchor, delta);
    case 'yearly':
      return `${parseDay(anchor).year + delta}-01-01`;
    case 'monthly':
    default:
      return addMonths(anchor, delta);
  }
}

/**
 * The window immediately before `anchor`'s, for period-over-period comparison.
 *
 * Derived by shifting the anchor rather than by subtracting days from the
 * window, so "the previous month" is a whole calendar month (28-31 days) rather
 * than a fixed-length block that drifts out of alignment.
 */
export function previousWindow(period: DashboardPeriod, anchor: CalendarDay): PeriodWindow {
  return windowFor(period, shiftAnchor(period, anchor, -1));
}

/** True when the anchor's window contains `reference` — used to stop "next" running into the future. */
export function isCurrentPeriod(
  period: DashboardPeriod,
  anchor: CalendarDay,
  reference: CalendarDay,
): boolean {
  const { dateFrom, dateTo } = windowFor(period, anchor);
  return reference >= dateFrom && reference <= dateTo;
}

/** A human label for the window — the text between the ← / → controls. */
export function formatPeriodLabel(period: DashboardPeriod, anchor: CalendarDay): string {
  const { year } = parseDay(anchor);

  switch (period) {
    case 'daily':
      return formatDay(anchor);
    case 'weekly': {
      const { dateFrom, dateTo } = windowFor('weekly', anchor);
      return `${formatDay(dateFrom)} – ${formatDay(dateTo)}`;
    }
    case 'quarterly':
      return `Q${quarterOf(anchor)} ${year}`;
    case 'yearly':
      return String(year);
    case 'monthly':
    default:
      return formatMonthYear(anchor);
  }
}
