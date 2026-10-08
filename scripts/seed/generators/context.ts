import { dayList, monthOf, type StoryDates } from '../calendar.ts';
import type { LedgerBuilder } from '../ledger.ts';
import type { Rng } from '../rng.ts';

export interface GeneratorContext {
  builder: LedgerBuilder;
  rng: Rng;
  dates: StoryDates;
  /** H0 … A − 1. */
  days: string[];
}

export function generatorContext(builder: LedgerBuilder, rng: Rng, dates: StoryDates): GeneratorContext {
  return { builder, rng, dates, days: dayList(dates.historyStart, dates.historyEnd) };
}

/** 1 for H0's month, 2 for the next, … */
export function historyMonth(dates: StoryDates, day: string): number {
  const start = dates.historyStart;
  return (Number(day.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + (Number(day.slice(5, 7)) - Number(start.slice(5, 7))) + 1;
}

export const onTrip = (dates: StoryDates, day: string) => day >= dates.japan.departs && day <= dates.historyEnd;

/** A Vietnamese bank transfer reference, e.g. FT26281437095. */
export function bankReference(ctx: GeneratorContext, day: string): string {
  return `FT${day.slice(2, 4)}${String(ctx.rng.int(0, 99_999_999)).padStart(8, '0')}`;
}

export const monthNumber = (day: string) => Number(monthOf(day).slice(5));
