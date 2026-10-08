// Every figure the plan quotes, computed from the ledger with the same calendar the server reads with
// (budgetWindow, dayOfInstant). The dry run prints these; verify.ts compares the API against them.

import { budgetWindow, dayOfInstant, percentageOf } from '@sora/contracts';

import { addDays, addMonths, daylightSavingDays, dayList, monthOf, type StoryDates } from './calendar.ts';
import { formatAmount, money, type Ledger, type Row } from './ledger.ts';
import { ACCOUNTS, BUDGETS, CUSTOM_CATEGORIES, GOALS, WALLETS, type BudgetDef, type GoalKey, type WalletKey } from './personas.ts';

export type Totals = Map<string, bigint>;

const bump = (totals: Totals, currency: string, amount: bigint) => totals.set(currency, (totals.get(currency) ?? 0n) + amount);

/** The category and every custom descendant (a category budget counts its subcategories at any depth). */
export function categorySubtree(wallet: WalletKey, key: string): Set<string> {
  const keys = new Set([key]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of CUSTOM_CATEGORIES) {
      if (category.wallet === wallet && category.parent !== null && keys.has(category.parent) && !keys.has(category.key)) {
        keys.add(category.key);
        grew = true;
      }
    }
  }
  return keys;
}

export interface BudgetReading {
  startDate: string;
  endDate: string;
  spent: bigint;
  usage: number;
}

export function budgetSchedule(budget: BudgetDef, dates: StoryDates) {
  return { periodType: budget.periodType, startDate: budget.start(dates), endDate: budget.end(dates) };
}

/** `spent` on `day`: COMPLETED expenses in the budget's wallet and currency, in its target, inside the window. */
export function readBudget(ledger: Ledger, budget: BudgetDef, dates: StoryDates, day: string): BudgetReading {
  const window = budgetWindow(budgetSchedule(budget, dates), day);
  const zone = WALLETS[budget.wallet].timeZone;
  const subtree = budget.category ? categorySubtree(budget.wallet, budget.category) : null;
  let spent = 0n;
  for (const row of ledger.rows) {
    if (row.status !== 'COMPLETED' || row.type !== 'EXPENSE') continue;
    const account = ACCOUNTS[row.from!];
    if (account.wallet !== budget.wallet || account.currency !== budget.currency) continue;
    if (budget.goal ? row.goal !== budget.goal : subtree ? !subtree.has(row.category!) : false) continue;
    const local = dayOfInstant(row.instant, zone);
    if (local >= window.startDate && local <= window.endDate) spent += row.amount;
  }
  return { ...window, spent, usage: percentageOf(spent, money(budget.amount)) };
}

export function goalCurrent(ledger: Ledger, goal: GoalKey): bigint {
  return ledger.contributions.filter((entry) => entry.goal === goal && !entry.removed).reduce((sum, entry) => sum + entry.amount, 0n);
}

export interface PeriodFigures {
  income: Totals;
  expense: Totals;
  transferredIn: Totals;
  transferredOut: Totals;
}

/** A wallet's dashboard figures over [from, to] in its own zone; transfers count only across its boundary (BR-06). */
export function periodFigures(ledger: Ledger, wallet: WalletKey, from: string, to: string): PeriodFigures {
  const zone = WALLETS[wallet].timeZone;
  const figures: PeriodFigures = { income: new Map(), expense: new Map(), transferredIn: new Map(), transferredOut: new Map() };
  for (const row of ledger.rows) {
    if (row.status !== 'COMPLETED') continue;
    const day = dayOfInstant(row.instant, zone);
    if (day < from || day > to) continue;
    const fromWallet = row.from ? ACCOUNTS[row.from].wallet : null;
    const toWallet = row.to ? ACCOUNTS[row.to].wallet : null;
    const currency = ACCOUNTS[(row.from ?? row.to)!].currency;
    if (row.type === 'INCOME' && toWallet === wallet) bump(figures.income, currency, row.amount);
    if (row.type === 'EXPENSE' && fromWallet === wallet) bump(figures.expense, currency, row.amount);
    if (row.type === 'TRANSFER' && fromWallet !== toWallet) {
      if (toWallet === wallet) bump(figures.transferredIn, currency, row.amount);
      if (fromWallet === wallet) bump(figures.transferredOut, currency, row.amount);
    }
  }
  return figures;
}

export function walletBalances(ledger: Ledger, wallet: WalletKey): Totals {
  const totals: Totals = new Map();
  for (const account of Object.values(ACCOUNTS)) if (account.wallet === wallet) bump(totals, account.currency, ledger.balances[account.key]);
  return totals;
}

/** Calendar months touched by the history, H0's month to A's. */
export function historyMonths(dates: StoryDates): { month: string; from: string; to: string }[] {
  const months: { month: string; from: string; to: string }[] = [];
  for (let first = dates.historyStart; first <= dates.anchor; first = addMonths(first, 1)) {
    months.push({ month: monthOf(first), from: first, to: addDays(addMonths(first, 1), -1) });
  }
  return months;
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  /** A §7 state or a ledger invariant: a miss fails the dry run. Otherwise a §6 claim, reported only. */
  hard: boolean;
}

const pct = (value: number) => `${value.toFixed(1)}%`;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const budget = (key: string) => BUDGETS.find((entry) => entry.key === key)!;

export function storyChecks(ledger: Ledger, dates: StoryDates): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string, hard = false) => checks.push({ name, ok, detail, hard });
  const atAnchor = (key: string) => readBudget(ledger, budget(key), dates, dates.readingDay);
  const months = historyMonths(dates).filter((month) => month.to < dates.anchor);
  const monthly = (key: string) => months.map((month) => ({ month: month.month, ...readBudget(ledger, budget(key), dates, month.from) }));
  const weeks = dayList(dates.firstMonday, addDays(dates.historyEnd, -6)).filter((_, index) => index % 7 === 0);
  const weekly = (key: string) => weeks.map((week) => readBudget(ledger, budget(key), dates, week).usage);
  const tetMonth = monthOf(dates.tet);

  // §7 item 5: the five states at the anchor.
  const housing = atAnchor('housing');
  add(`near: Housing on ${dates.readingDay}`, housing.usage >= 80 && housing.usage <= 100, pct(housing.usage), true);
  const sale = readBudget(ledger, budget('sale'), dates, dates.sale.start);
  add('over: 11.11 Sale', sale.usage > 100, pct(sale.usage), true);
  const travel = atAnchor('travel');
  add(`under: Travel on ${dates.readingDay}`, travel.usage < 80, pct(travel.usage), true);
  const cap = atAnchor('cap');
  add(`Monthly Cap under on ${dates.readingDay} too`, cap.usage < 80, pct(cap.usage));
  const coffee = readBudget(ledger, budget('coffee'), dates, dates.lastSaturday);
  add(`zero-spent: Coffee on ${dates.lastSaturday}`, coffee.spent === 0n, formatAmount(coffee.spent, 'VND'), true);
  const nextTet = readBudget(ledger, budget('nextTet'), dates, dates.anchor);
  add('future: Next Tet', budget('nextTet').start(dates) > dates.anchor && nextTet.spent === 0n, `${nextTet.startDate} → ${nextTet.endDate}`, true);

  // Ledger invariants.
  const nonCredit = Object.values(ACCOUNTS).filter((account) => account.type !== 'CREDIT_CARD');
  const lowest = nonCredit.map((account) => `${account.key} ${formatAmount(ledger.minimums[account.key].amount, account.currency)}`);
  add('no non-credit account below zero', nonCredit.every((account) => ledger.minimums[account.key].amount >= 0n), lowest.join(', '), true);
  const japanLeft = ledger.balances.jpy;
  add('Japan Cash covers the ¥35,000 ryokan', japanLeft >= money(35_000), `¥${formatAmount(japanLeft, 'JPY')} left`, true);
  for (const result of earmarkChecks(ledger, dates)) add(result.name, result.ok, result.detail, true);

  // §6.1 goal states.
  const progress = (key: GoalKey) => {
    const goal = GOALS.find((entry) => entry.key === key)!;
    return percentageOf(goalCurrent(ledger, key), money(goal.target));
  };
  add('goal 0%: Wedding Fund', goalCurrent(ledger, 'wedding') === 0n, pct(progress('wedding')), true);
  add('goal over-funded: New Motorbike', progress('motorbike') > 100, pct(progress('motorbike')), true);
  add('goal overdue: Laptop Repair (ACTIVE, date passed, short of target)', progress('laptop') < 100 && GOALS.find((goal) => goal.key === 'laptop')!.targetDate(dates)! < dates.anchor, pct(progress('laptop')), true);
  for (const [key, expected] of [['emergency', 55], ['japan', 70], ['macbook', 30], ['guitar', 20], ['anniversary', 40], ['health', 65]] as const) {
    add(`goal ≈ ${expected}%: ${key}`, Math.abs(progress(key) - expected) < 1.5, pct(progress(key)), true);
  }

  // §6.2 claims for a typical period.
  const food = monthly('food');
  const foodTet = food.find((month) => month.month === tetMonth);
  add('Food under 80% outside the Tet month', food.every((month) => month.month === tetMonth || month.usage < 80), food.filter((month) => month.month !== tetMonth).map((month) => pct(month.usage)).join(' '));
  add('Food over in the Tet month', (foodTet?.usage ?? 0) > 100, pct(foodTet?.usage ?? 0));
  const dining = weekly('weekendDining');
  add('Weekend Dining 80–100% on average', mean(dining) >= 80 && mean(dining) <= 100, pct(mean(dining)));
  const coffeeOver = dayList(dates.historyStart, dates.historyEnd).filter((day) => readBudget(ledger, budget('coffee'), dates, day).usage > 100).length;
  add('Coffee over on some days', coffeeOver > 0, `${coffeeOver} days`);
  const bills = new Map<string, number>();
  for (const month of historyMonths(dates)) {
    const reading = readBudget(ledger, budget('bills'), dates, month.from);
    if (reading.endDate < dates.anchor && reading.startDate >= budget('bills').start(dates)) bills.set(monthOf(reading.endDate), reading.usage);
  }
  const hot = [...bills].filter(([month]) => ['04', '05', '06'].includes(month.slice(5)));
  add('Bills over in Apr–Jun', hot.length > 0 && hot.every(([, usage]) => usage > 100), hot.map(([month, usage]) => `${month} ${pct(usage)}`).join(' '));
  add('Bills at most 100% outside Apr–Jun', [...bills].every(([month, usage]) => ['04', '05', '06'].includes(month.slice(5)) || usage <= 100), '');
  const courses = atAnchor('courses');
  add('Online Courses above 0 at the anchor', courses.spent > 0n, pct(courses.usage));
  const japanBudget = readBudget(ledger, budget('japanTrip'), dates, dates.anchor);
  add('Japan Trip budget ≈ 72%', japanBudget.usage > 65 && japanBudget.usage < 80, pct(japanBudget.usage));
  const capMonths = monthly('cap');
  const eventMonths = new Set([tetMonth, monthOf(dates.motorbike.firstPayment), monthOf(dates.motorbike.finalPayment), monthOf(dates.japan.flights), monthOf(dates.japan.jrPass), monthOf(dates.japan.exchange)]);
  add('Monthly Cap over in event months', capMonths.filter((month) => eventMonths.has(month.month)).every((month) => month.usage > 100), capMonths.filter((month) => eventMonths.has(month.month)).map((month) => `${month.month} ${pct(month.usage)}`).join(' '));
  add('Monthly Cap at most 100% in other months (11.11 month aside)', capMonths.filter((month) => !eventMonths.has(month.month) && month.month !== monthOf(dates.sale.start)).every((month) => month.usage <= 100), capMonths.filter((month) => !eventMonths.has(month.month)).map((month) => `${month.month} ${pct(month.usage)}`).join(' '));
  const tetSpend = ledger.rows.filter((row) => row.tag === 'tet' && row.status === 'COMPLETED').reduce((sum, row) => sum + row.amount, 0n);
  add('Tet cluster at least 12,000,000', tetSpend >= money(12_000_000), formatAmount(tetSpend, 'VND'));
  const linhGroceries = monthly('linhGroceries');
  add('Linh Groceries at most 100% every month', linhGroceries.every((month) => month.usage <= 100), linhGroceries.map((month) => pct(month.usage)).join(' '));
  const linhWeeks = weekly('linhEverything');
  add('Linh Everything 80–100% on average', mean(linhWeeks) >= 80 && mean(linhWeeks) <= 100, pct(mean(linhWeeks)));
  const market = monthly('momMarket');
  add('Mom Market under 80% every month', market.every((month) => month.usage < 80), market.map((month) => pct(month.usage)).join(' '));
  const baoWeeks = weekly('baoGroceries');
  add('Bao Groceries 80–100% on average', mean(baoWeeks) >= 80 && mean(baoWeeks) <= 100, pct(mean(baoWeeks)));
  for (const day of daylightSavingDays(dates.firstMonday, dates.historyEnd, WALLETS.bao.timeZone)) {
    const shops = ledger.rows.filter((row) => row.tag === 'baoDstShop' && row.day === day);
    const week = readBudget(ledger, budget('baoGroceries'), dates, day);
    const holds = shops.length === 1 && week.startDate <= day && day <= week.endDate && week.spent >= shops[0]!.amount;
    add(`Bao's Groceries week of ${day} (daylight saving) holds that day's 23:45 shop`, holds, `${week.startDate} → ${week.endDate}, ${formatAmount(week.spent, 'AUD')}`, true);
  }
  return checks;
}

/**
 * Until a goal's money starts being spent, an account's active earmarks never exceed its balance. Japan's
 * spending starts with the transfer at A − 9 weeks; after that, only the other goals' earmarks are held to it.
 */
export function earmarkChecks(ledger: Ledger, dates: StoryDates): { name: string; ok: boolean; detail: string }[] {
  const released: Partial<Record<GoalKey, string>> = { motorbike: dates.motorbike.finalPayment, guitar: dates.guitarCancelled };
  const results: { name: string; ok: boolean; detail: string }[] = [];
  for (const account of ['tcb', 'wise', 'bidv'] as const) {
    let balance = money(ACCOUNTS[account].opening);
    let worst = { margin: null as bigint | null, day: '' };
    for (const day of dayList(dates.historyStart, dates.historyEnd)) {
      balance = ledger.endOfDay[account].get(day) ?? balance;
      const held = ledger.contributions
        .filter((entry) => entry.account === account && !entry.row && entry.day <= day)
        .filter((entry) => !(released[entry.goal] && released[entry.goal]! <= day))
        .filter((entry) => day < dates.japan.transfer || entry.goal !== 'japan')
        .reduce((sum, entry) => sum + entry.amount, 0n);
      const margin = balance - held;
      if (worst.margin === null || margin < worst.margin) worst = { margin, day };
    }
    results.push({
      name: `earmarks on ${account} within its balance`,
      ok: (worst.margin ?? 0n) >= 0n,
      detail: `tightest ${formatAmount(worst.margin ?? 0n, ACCOUNTS[account].currency)} on ${worst.day}`,
    });
  }
  return results;
}

export const rowsOfWallet = (ledger: Ledger, wallet: WalletKey): Row[] =>
  ledger.rows.filter((row) => (row.from && ACCOUNTS[row.from].wallet === wallet) || (row.to && ACCOUNTS[row.to].wallet === wallet));
