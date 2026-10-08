// Plan §7: read everything back through the API and fail loudly on any difference from the generator's ledger.

import { createHash } from 'node:crypto';

import {
  dayOfInstant,
  formatMoney,
  type AccountDetailResponse,
  type BudgetResponse,
  type CurrencyTotal,
  type DashboardResponse,
  type GoalResponse,
  type TransactionResponse,
  type WalletMemberResponse,
  type WalletResponse,
} from '@sora/contracts';

import type { SeedApi, Session } from './client.ts';
import { addDays, daylightSavingDays, type StoryDates } from './calendar.ts';
import { goalCurrent, historyMonths, periodFigures, readBudget, rowsOfWallet, walletBalances, type Totals } from './figures.ts';
import { applyRow, openingBalances, type Ledger, type Row } from './ledger.ts';
import { ACCOUNTS, BUDGETS, GOALS, WALLETS, type AccountKey, type PersonaKey, type WalletKey } from './personas.ts';
import type { Seeder } from './post.ts';

export class VerifyError extends Error {}

/** Who reads each wallet: a current member (Khoa loses Shared House at the revoke). */
const READER: Record<WalletKey, PersonaKey> = { an: 'an', mom: 'an', linh: 'an', house: 'an', khoa: 'khoa', bao: 'bao' };

const asTotals = (list: CurrencyTotal[]): string =>
  list.filter((entry) => !/^-?0(\.0+)?$/.test(entry.amount)).map((entry) => `${entry.currency} ${entry.amount}`).sort().join(', ');
const fromTotals = (totals: Totals): string =>
  [...totals].filter(([, amount]) => amount !== 0n).map(([currency, amount]) => `${currency} ${formatMoney(amount)}`).sort().join(', ');

export class Verifier {
  private failures: string[] = [];
  private passes = 0;
  private readonly api: SeedApi;
  private readonly seeder: Seeder;
  private readonly ledger: Ledger;
  private readonly dates: StoryDates;

  constructor(api: SeedApi, seeder: Seeder, ledger: Ledger, dates: StoryDates) {
    this.api = api;
    this.seeder = seeder;
    this.ledger = ledger;
    this.dates = dates;
  }

  private expect(name: string, actual: unknown, expected: unknown): void {
    if (JSON.stringify(actual) === JSON.stringify(expected)) this.passes++;
    else this.failures.push(`${name}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }

  private reader(wallet: WalletKey): Session {
    return this.seeder.session(READER[wallet]);
  }

  private finish(label: string): void {
    console.log(`  ${label}: ${this.passes} checks passed${this.failures.length ? `, ${this.failures.length} FAILED` : ''}`);
    if (this.failures.length) {
      for (const failure of this.failures.slice(0, 25)) console.log(`    ✗ ${failure}`);
      throw new VerifyError(`${label}: ${this.failures.length} mismatches`);
    }
    this.passes = 0;
  }

  /** Item 1 against a given set of expected balances. */
  async balances(expected: Record<AccountKey, bigint>, label: string): Promise<void> {
    for (const account of Object.values(ACCOUNTS)) {
      const detail = await this.api.call<AccountDetailResponse>('GET', `/accounts/${this.seeder.ids.accounts[account.key]}`, { session: this.reader(account.wallet) });
      this.expect(`balance ${account.key}`, detail.balance, formatMoney(expected[account.key]));
    }
    this.finish(label);
  }

  /** Balances as phase 4 leaves them: rows as first entered, duplicates still live, no contributions yet. */
  static postedBalances(ledger: Ledger): Record<AccountKey, bigint> {
    const balances = openingBalances();
    for (const row of ledger.rows) {
      if (row.contribution) continue;
      const mistake = row.mistake;
      const status = mistake?.kind === 'duplicate' ? 'COMPLETED' : row.status;
      if (status !== 'COMPLETED') continue;
      applyRow(balances, { type: mistake?.type ?? row.type, from: row.from, to: mistake && 'to' in mistake ? mistake.to! : row.to, amount: mistake?.amount ?? row.amount });
    }
    return balances;
  }

  async all(): Promise<void> {
    const { ids } = this.seeder;
    const dates = this.dates;

    // 1. Balances
    await this.balances(this.ledger.balances, 'item 1, balances');

    // 2–3. BR-06 and per-currency totals, month by month in the wallet's zone
    for (const wallet of ['an', 'bao'] as const) {
      const zone = WALLETS[wallet].timeZone;
      for (const month of historyMonths(dates)) {
        const dashboard = await this.api.call<DashboardResponse>('GET', `/dashboard?walletId=${ids.wallets[wallet]}&dateFrom=${month.from}&dateTo=${month.to}`, { session: this.reader(wallet) });
        const expected = periodFigures(this.ledger, wallet, month.from, month.to);
        const label = `${wallet} ${month.month}`;
        this.expect(`${label} period.timeZone`, dashboard.period.timeZone, zone);
        this.expect(`${label} income`, asTotals(dashboard.income), fromTotals(expected.income));
        this.expect(`${label} expense`, asTotals(dashboard.expense), fromTotals(expected.expense));
        this.expect(`${label} transferredIn`, asTotals(dashboard.transferredIn), fromTotals(expected.transferredIn));
        this.expect(`${label} transferredOut`, asTotals(dashboard.transferredOut), fromTotals(expected.transferredOut));
        this.expect(`${label} totalBalance`, asTotals(dashboard.totalBalance), fromTotals(walletBalances(this.ledger, wallet)));
      }
    }
    const midnightRent = this.ledger.rows.find((row) => row.tag === 'rentMidnight')!;
    this.expect('00:10 rent files under its local month', dayOfInstant(midnightRent.instant, WALLETS.an.timeZone).slice(0, 7), midnightRent.day.slice(0, 7));
    this.expect('00:10 rent is the day before in UTC', midnightRent.instant.slice(0, 10), addDays(midnightRent.day, -1));
    this.finish('items 2–3, dashboard months and currencies');

    // 4. Coverage: the API's count per wallet × type × status equals the ledger's
    const table: string[] = [];
    for (const wallet of Object.keys(WALLETS) as WalletKey[]) {
      const rows = rowsOfWallet(this.ledger, wallet);
      for (const type of ['INCOME', 'EXPENSE', 'TRANSFER'] as const) {
        for (const status of ['COMPLETED', 'PENDING', 'DELETED'] as const) {
          const expected = rows.filter((row) => row.type === type && row.status === status).length;
          const response = await this.api.raw('GET', `/transactions?walletId=${ids.wallets[wallet]}&type=${type}&status=${status}&pageSize=1`, { session: this.reader(wallet) });
          this.expect(`${wallet} ${type} ${status} count`, response.body?.meta?.pagination?.total, expected);
          if (expected > 0) table.push(`${wallet.padEnd(5)} ${type.padEnd(8)} ${status.padEnd(9)} ${expected}`);
        }
      }
    }
    this.finish('item 4, coverage');
    console.log(`    ${table.join('\n    ')}`);

    // 5. Budget states, read where §7 says: repeating at the reading day (weekly at the last Sunday), fixed unfiltered
    const listed = new Map<string, BudgetResponse>();
    for (const wallet of ['an', 'linh', 'mom', 'bao'] as const) {
      for (const budget of await this.api.all<BudgetResponse>(`/budgets?walletId=${ids.wallets[wallet]}`, this.reader(wallet))) listed.set(budget.id, budget);
    }
    const readOn = async (key: string, day: string) => {
      const budget = BUDGETS.find((entry) => entry.key === key)!;
      const read = await this.api.all<BudgetResponse>(`/budgets?walletId=${ids.wallets[budget.wallet]}&activeOn=${day}`, this.reader(budget.wallet));
      return read.find((entry) => entry.id === ids.budgets[key]);
    };
    for (const budget of BUDGETS) {
      const fixed = budget.periodType === 'CUSTOM' || budget.periodType === 'GOAL';
      const day = fixed ? budget.start(dates) : budget.periodType === 'WEEKLY' ? dates.lastSunday : budget.key === 'coffee' ? dates.lastSaturday : dates.readingDay;
      const read = fixed ? listed.get(ids.budgets[budget.key]!) : await readOn(budget.key, day);
      const expected = readBudget(this.ledger, budget, dates, day);
      this.expect(`budget ${budget.key} window`, read && [read.periodStart, read.periodEnd], [expected.startDate, expected.endDate]);
      this.expect(`budget ${budget.key} spent`, read?.spent, formatMoney(expected.spent));
    }
    const state = (key: string) => listed.get(this.seeder.ids.budgets[key]!)!;
    const housing = await readOn('housing', dates.readingDay);
    this.expect('near: Housing', housing !== undefined && housing.usagePercentage >= 80 && housing.usagePercentage <= 100, true);
    this.expect('over: 11.11 Sale', state('sale').isOverBudget, true);
    const travel = await readOn('travel', dates.readingDay);
    this.expect('under: Travel', travel !== undefined && travel.usagePercentage < 80, true);
    const coffee = await readOn('coffee', dates.lastSaturday);
    this.expect('zero-spent: Coffee on the last Saturday', coffee?.spent, '0.0000');
    this.expect('future: Next Tet', state('nextTet').startDate > dates.anchor && state('nextTet').spent === '0.0000', true);
    this.finish('item 5, budget states');

    // 6. Goal states
    for (const wallet of ['an', 'linh', 'mom'] as const) {
      const goals = await this.api.all<GoalResponse>(`/goals?walletId=${ids.wallets[wallet]}`, this.reader(wallet));
      for (const goal of GOALS.filter((entry) => entry.wallet === wallet)) {
        const read = goals.find((entry) => entry.id === ids.goals[goal.key]);
        this.expect(`goal ${goal.key} status`, read?.status, goal.end);
        this.expect(`goal ${goal.key} currentAmount`, read?.currentAmount, formatMoney(goalCurrent(this.ledger, goal.key)));
      }
      if (wallet === 'an') {
        this.expect('Wedding Fund lists first (newest)', goals[0]?.id, ids.goals.wedding);
        const motorbike = goals.find((goal) => goal.id === ids.goals.motorbike)!;
        this.expect('over-funded: Motorbike progress caps at 100', [motorbike.progressPercentage, BigInt(motorbike.currentAmount.replace('.', '')) > BigInt(motorbike.targetAmount.replace('.', ''))], [100, true]);
        const laptop = goals.find((goal) => goal.id === ids.goals.laptop)!;
        this.expect('overdue: Laptop Repair', laptop.status === 'ACTIVE' && laptop.targetDate! < dates.anchor && laptop.progressPercentage < 100, true);
        this.expect('0%: Wedding Fund', goals.find((goal) => goal.id === ids.goals.wedding)?.progressPercentage, 0);
      }
    }
    this.finish('item 6, goal states');

    // 7. Roles, revocation, archived wallet
    const linhWallets = await this.api.call<WalletResponse[]>('GET', '/wallets', { session: this.seeder.session('linh') });
    this.expect("Linh is VIEWER on An's wallet", linhWallets.find((wallet) => wallet.id === ids.wallets.an)?.role, 'VIEWER');
    const anMembers = await this.api.call<WalletMemberResponse[]>('GET', `/wallets/${ids.wallets.an}/members`, { session: this.seeder.session('an') });
    this.expect("An's word for Linh", anMembers.find((member) => member.userId === ids.users.linh?.id)?.relationLabel, 'Girlfriend');
    const revoked = await this.api.call<WalletMemberResponse[]>('GET', `/wallets/${ids.wallets.house}/members?status=REVOKED`, { session: this.seeder.session('an') });
    this.expect('Khoa revoked on Shared House', revoked.map((member) => member.userId), [ids.users.khoa?.id]);
    const houseRows = await this.api.all<TransactionResponse>(`/transactions?walletId=${ids.wallets.house}`, this.seeder.session('an'));
    const khoaRows = this.ledger.rows.filter((row) => row.by === 'khoa' && (row.from === 'kitty' || row.to === 'kitty')).length;
    this.expect("Khoa's Shared House rows still show his name", houseRows.filter((row) => row.createdBy.displayName === 'Khoa').length, khoaRows);
    const archived = await this.api.call<WalletResponse[]>('GET', '/wallets?status=ARCHIVED', { session: this.seeder.session('an') });
    this.expect('Shared House archived', archived.map((wallet) => wallet.id), [ids.wallets.house]);
    const preview = await this.api.call<{ invitedEmail: string }>('POST', '/invitations/preview', { body: { token: ids.sisterInvitation!.token }, expect: [200, 201] });
    this.expect("the sister's invitation previews with a masked email", preview.invitedEmail !== ids.sisterInvitation!.email, true);
    this.finish('item 7, roles');

    // 9. Zones and daylight saving (Bao, Melbourne)
    for (const day of daylightSavingDays(dates.historyStart, dates.historyEnd, WALLETS.bao.timeZone)) {
      for (const edge of [day, addDays(day, 1)]) {
        if (edge > dates.historyEnd) continue;
        const listedRows = await this.api.all<TransactionResponse>(`/transactions?walletId=${ids.wallets.bao}&dateFrom=${edge}&dateTo=${edge}`, this.seeder.session('bao'));
        const expected = rowsOfWallet(this.ledger, 'bao').filter((row) => dayOfInstant(row.instant, WALLETS.bao.timeZone) === edge).map((row) => ids.transactions[row.id]);
        this.expect(`Bao's rows on ${edge}`, listedRows.map((row) => row.id).sort(), expected.sort());
      }
      if (day >= dates.firstMonday) {
        const week = await readOn('baoGroceries', day);
        const shop = this.ledger.rows.find((row) => row.tag === 'baoDstShop' && row.day === day)!;
        this.expect(`Bao's Groceries week of ${day} holds the 23:45 shop`, week !== undefined && week.periodStart <= day && day <= week.periodEnd && BigInt(week.spent.replace('.', '')) >= shop.amount, true);
      }
    }
    this.finish('item 9, zones and daylight saving');
  }
}

/** Item 8's fingerprint: the same SEED and anchor must give the same ledger, run after run. */
export function ledgerDigest(ledger: Ledger): string {
  const canonical = (row: Row) => [row.type, row.status, row.from, row.to, formatMoney(row.amount), row.category, row.goal, row.instant, row.description, row.reference, row.mistake ? JSON.stringify(row.mistake, (_, value) => (typeof value === 'bigint' ? formatMoney(value) : value)) : ''].join('|');
  const hash = createHash('sha256');
  for (const row of ledger.rows) hash.update(`${canonical(row)}\n`);
  for (const entry of ledger.contributions) hash.update(`${entry.goal}|${entry.account}|${formatMoney(entry.amount)}|${entry.instant}|${entry.removed ?? false}\n`);
  return hash.digest('hex').slice(0, 16);
}
