// A direct path, not `@/utils`: node --test runs this file and has no alias.
import { addMonths, endOfMonth, endOfYear, type CalendarDay } from '../../utils/date.ts';

export const GOAL_DEADLINE_PRESETS = ['endOfThisMonth', 'in3Months', 'in6Months', 'endOfThisYear', 'in1Year', 'in2Years'] as const;
export type GoalDeadlinePreset = (typeof GOAL_DEADLINE_PRESETS)[number];

/** "In N months" keeps the day of the month, clamped to a shorter month's last day (Jan 31 → Feb 28). */
function presetDay(preset: GoalDeadlinePreset, from: CalendarDay): CalendarDay {
  switch (preset) {
    case 'endOfThisMonth':
      return endOfMonth(from);
    case 'in3Months':
      return addMonths(from, 3);
    case 'in6Months':
      return addMonths(from, 6);
    case 'endOfThisYear':
      return endOfYear(from);
    case 'in1Year':
      return addMonths(from, 12);
    case 'in2Years':
      return addMonths(from, 24);
  }
}

/**
 * Every preset's day counted from `from`, never before it. In December "end of this month" and
 * "end of this year" are the same day, so only the later, longer-horizon label is kept.
 */
export function goalDeadlinePresets(from: CalendarDay): { preset: GoalDeadlinePreset; day: CalendarDay }[] {
  const all = GOAL_DEADLINE_PRESETS.map((preset) => ({ preset, day: presetDay(preset, from) }));
  return all.filter((entry, index) => !all.slice(index + 1).some((later) => later.day === entry.day));
}
