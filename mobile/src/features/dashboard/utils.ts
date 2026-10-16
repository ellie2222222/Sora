import type { CalendarDay } from '@/utils';

export function monthsOfYear(year: number): CalendarDay[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}-01`);
}
