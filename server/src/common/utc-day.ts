/** The UTC midnight after `date` (YYYY-MM-DD): the exclusive end of a window of whole UTC days (calc.ts isWithinPeriod). */
export function dayAfter(date: string): Date {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
