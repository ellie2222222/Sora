// The "real user mistakes" pass (plan §5.6): about 2% of rows are first entered wrong, then fixed. The
// ledger holds each row's final state; `mistake` holds what the first create sends, which phase 6 fixes.

import { addDays, firstOfMonth, instantOf } from '../calendar.ts';
import { zoneOfRow, type Row } from '../ledger.ts';
import type { GeneratorContext } from './context.ts';

/** Same-wallet everyday rows: no goal tag, no contribution behind them, no dynamic amount, no cross-wallet side. */
const HABIT_TAGS = new Set(['coffee', 'breakfast', 'lunch', 'grab', 'fuel', 'groceries', 'dining', 'snack', 'shopping', 'pets', 'market', 'linhHabit']);

export function corrections(ctx: GeneratorContext): void {
  const { builder: b, rng, dates } = ctx;
  const used = new Set<string>();
  const pool = (filter: (row: Row) => boolean) =>
    b.rows.filter((row) => !used.has(row.id) && row.status === 'COMPLETED' && row.day > dates.historyStart && filter(row));
  const take = (candidates: Row[], count: number): Row[] => {
    const picked: Row[] = [];
    while (picked.length < count && candidates.length > 0) {
      const [row] = candidates.splice(rng.int(0, candidates.length - 1), 1);
      used.add(row!.id);
      picked.push(row!);
    }
    return picked;
  };
  const habit = (row: Row) => HABIT_TAGS.has(row.tag);

  const total = Math.round(b.rows.length * 0.02);
  const duplicates = 10;
  const typeFixes = 3;
  const each = Math.max(1, Math.floor((total - duplicates - typeFixes) / 3));

  // 1. The same Grab ride posted twice within a minute; the second is deleted.
  for (const ride of take(pool((row) => row.tag === 'grab'), duplicates)) {
    const minutes = Number(ride.time.slice(0, 2)) * 60 + Number(ride.time.slice(3, 5)) + 1;
    b.add({
      by: ride.by, type: ride.type, status: 'DELETED', from: ride.from, to: ride.to, amount: ride.amount, category: ride.category,
      day: ride.day, time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
      description: ride.description, tag: 'duplicate', mistake: { kind: 'duplicate' },
    });
  }

  // 2. An extra zero typed: 450,000 entered as 4,500,000.
  for (const row of take(pool(habit), each)) row.mistake = { kind: 'amount', amount: row.amount * 10n };

  // 3. A card payoff recorded as an expense, fixed into the transfer it was.
  for (const row of take(pool((candidate) => candidate.dynamic === 'payoff' && candidate.day < addDays(dates.anchor, -60)), typeFixes)) {
    row.mistake = { kind: 'type', type: 'EXPENSE', to: null, category: 'other_expense' };
    row.description = 'Visa payment';
  }

  // 4. Groceries filed under Dining Out.
  for (const row of take(pool((candidate) => candidate.tag === 'groceries'), each)) row.mistake = { kind: 'category', category: 'dining_out' };

  // 5. Entered a day late and moved back one day; the first one crosses a month boundary.
  const late = [
    ...take(pool((row) => habit(row) && row.day === firstOfMonth(row.day)), 1),
    ...take(pool(habit), each - 1),
  ];
  for (const row of late) {
    row.mistake = { kind: 'date', day: row.day };
    row.day = addDays(row.day, -1);
    row.instant = instantOf(row.day, row.time, zoneOfRow(row));
  }
}
