// The whole ledger in memory (plan §10 phase 3): rows from every generator, merged in instant order across
// wallets, with refills inserted before the spend that needs them, dynamic amounts resolved, and every
// non-credit balance checked. Amounts are scaled bigint (money.ts); a draw is a whole number of units,
// scaled before it is ever summed.

import { MONEY_SCALE, formatMoney, parseMoney, type TransactionStatus, type TransactionType } from '@sora/contracts';

import { instantOf } from './calendar.ts';
import { ACCOUNTS, REFILLS, walletOfAccount, type AccountKey, type GoalKey, type PersonaKey, type WalletKey } from './personas.ts';

const UNIT = 10n ** BigInt(MONEY_SCALE);

/** Whole currency units (VND, JPY) or a decimal string (USD/AUD cents), as scaled bigint. */
export function money(value: number | string): bigint {
  return typeof value === 'number' ? BigInt(value) * UNIT : parseMoney(value);
}

/** Cents as scaled bigint: USD and AUD draws are whole cents. */
export const cents = (value: number): bigint => (BigInt(value) * UNIT) / 100n;

export const formatAmount = (value: bigint, currency: string): string => {
  const text = formatMoney(value);
  return currency === 'USD' || currency === 'AUD' ? text.replace(/(\.\d\d)00$/, '$1') : text.replace(/\.0000$/, '');
};

export type CorrectionKind = 'duplicate' | 'amount' | 'type' | 'category' | 'date';

/** What a row looked like when first entered, before the corrections pass fixed it (plan §5.6). */
export interface Mistake {
  kind: CorrectionKind;
  type?: TransactionType;
  amount?: bigint;
  category?: string;
  day?: string;
  to?: AccountKey | null;
}

export interface Row {
  id: string;
  seq: number;
  by: PersonaKey;
  type: TransactionType;
  /** The final status. A duplicate is created COMPLETED and deleted; a removed contribution's backing row ends DELETED. */
  status: TransactionStatus;
  from: AccountKey | null;
  to: AccountKey | null;
  amount: bigint;
  /** A category key in the categorised account's wallet (the paying side for a transfer). */
  category: string | null;
  goal: GoalKey | null;
  /** Wall-clock day and time in the categorised account's wallet zone. */
  day: string;
  time: string;
  description: string | null;
  reference: string | null;
  tag: string;
  dynamic?: 'payoff' | 'close';
  /** Posted through POST /goals/{id}/contributions with recordAsTransaction. */
  contribution?: GoalKey;
  mistake?: Mistake;
  instant: string;
}

export interface Contribution {
  id: string;
  goal: GoalKey;
  account: AccountKey;
  amount: bigint;
  day: string;
  time: string;
  by: PersonaKey;
  /** The transaction-backed contribution's own row; absent on an earmark. */
  row?: string;
  /** Removed after creation (DELETE …/contributions/{id}); its row ends DELETED. */
  removed?: boolean;
  instant: string;
}

export type RowDraft = Omit<Row, 'id' | 'seq' | 'instant' | 'status' | 'description' | 'reference' | 'goal' | 'category' | 'from' | 'to'> & {
  from?: AccountKey | null;
  to?: AccountKey | null;
  status?: TransactionStatus;
  description?: string | null;
  reference?: string | null;
  goal?: GoalKey | null;
  category?: string | null;
};

export const categorisedAccount = (row: Pick<Row, 'type' | 'from' | 'to'>): AccountKey =>
  (row.type === 'INCOME' ? row.to : row.from)!;

export const walletOfRow = (row: Pick<Row, 'type' | 'from' | 'to'>): WalletKey => walletOfAccount(categorisedAccount(row)).key;

export const zoneOfRow = (row: Pick<Row, 'type' | 'from' | 'to'>): string => walletOfAccount(categorisedAccount(row)).timeZone;

export class LedgerBuilder {
  readonly rows: Row[] = [];
  readonly contributions: Contribution[] = [];
  private seq = 0;

  add(draft: RowDraft): Row {
    const row: Row = {
      status: 'COMPLETED',
      from: null,
      to: null,
      description: null,
      reference: null,
      goal: null,
      category: null,
      ...draft,
      id: `t${String(this.seq).padStart(5, '0')}`,
      seq: this.seq++,
      instant: '',
    };
    row.instant = instantOf(row.day, row.time, zoneOfRow(row));
    this.rows.push(row);
    return row;
  }

  contribute(contribution: Omit<Contribution, 'id' | 'instant'>): Contribution {
    const zone = walletOfAccount(contribution.account).timeZone;
    const entry = { ...contribution, id: `c${String(this.contributions.length).padStart(3, '0')}`, instant: instantOf(contribution.day, contribution.time, zone) };
    this.contributions.push(entry);
    return entry;
  }
}

export interface Ledger {
  /** Every row in instant order, refills included. */
  rows: Row[];
  contributions: Contribution[];
  balances: Record<AccountKey, bigint>;
  minimums: Record<AccountKey, { amount: bigint; day: string }>;
  /** End-of-day balance per account on each day it moved. */
  endOfDay: Record<AccountKey, Map<string, bigint>>;
}

export class LedgerError extends Error {}

/** Balances move only for COMPLETED rows (BR-05; a PENDING or DELETED row moves nothing). */
export function applyRow(balances: Record<AccountKey, bigint>, row: Pick<Row, 'type' | 'from' | 'to' | 'amount'>, sign = 1n): void {
  if (row.type !== 'INCOME') balances[row.from!] -= sign * row.amount;
  if (row.type !== 'EXPENSE') balances[row.to!] += sign * row.amount;
}

export function openingBalances(): Record<AccountKey, bigint> {
  return Object.fromEntries(Object.values(ACCOUNTS).map((account) => [account.key, parseMoney(account.opening)])) as Record<AccountKey, bigint>;
}

const roundUpTo = (value: bigint, step: bigint) => ((value + step - 1n) / step) * step;

export function settle(builder: LedgerBuilder, refillBy: (account: AccountKey) => PersonaKey): Ledger {
  const ordered = [...builder.rows].sort((a, b) => (a.instant < b.instant ? -1 : a.instant > b.instant ? 1 : a.seq - b.seq));
  const balances = openingBalances();
  const minimums = Object.fromEntries(Object.entries(balances).map(([key, amount]) => [key, { amount, day: '' }])) as Ledger['minimums'];
  const endOfDay = Object.fromEntries(Object.keys(balances).map((key) => [key, new Map<string, bigint>()])) as Ledger['endOfDay'];
  const rows: Row[] = [];

  const record = (row: Row) => {
    applyRow(balances, row);
    for (const account of [row.from, row.to]) {
      if (account === null) continue;
      endOfDay[account].set(row.day, balances[account]);
      if (ACCOUNTS[account].type !== 'CREDIT_CARD' && balances[account] < minimums[account].amount) {
        minimums[account] = { amount: balances[account], day: row.day };
      }
      if (ACCOUNTS[account].type !== 'CREDIT_CARD' && balances[account] < 0n) {
        throw new LedgerError(`${account} would go to ${formatMoney(balances[account])} on ${row.day} (${row.tag} ${row.id})`);
      }
    }
  };

  for (const row of ordered) {
    rows.push(row);
    if (row.status !== 'COMPLETED') continue;
    if (row.dynamic === 'payoff') row.amount = balances.visa < 0n ? -balances.visa : 0n;
    if (row.dynamic === 'close') row.amount = balances[row.from!];
    if (row.amount === 0n) {
      rows.pop();
      continue;
    }
    const debited = row.type === 'INCOME' ? null : row.from;
    const rule = debited ? REFILLS[debited] : undefined;
    if (debited && rule && balances[debited] - row.amount < money(rule.threshold)) {
      const needed = row.amount + money(rule.threshold);
      const amount = roundUpTo(needed > money(rule.minimum) ? needed : money(rule.minimum), money(rule.step));
      const refill: Row = {
        id: `${row.id}r`,
        seq: row.seq,
        by: refillBy(debited),
        type: 'TRANSFER',
        status: 'COMPLETED',
        from: rule.source,
        to: debited,
        amount,
        category: rule.category,
        goal: null,
        day: row.day,
        time: minuteBefore(row.time),
        description: rule.description,
        reference: null,
        tag: 'refill',
        instant: '',
      };
      refill.instant = instantOf(refill.day, refill.time, zoneOfRow(refill));
      rows.splice(rows.length - 1, 0, refill);
      record(refill);
    }
    record(row);
  }
  return { rows, contributions: builder.contributions, balances, minimums, endOfDay };
}

function minuteBefore(time: string): string {
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const earlier = Math.max(0, minutes - 1);
  return `${String(Math.floor(earlier / 60)).padStart(2, '0')}:${String(earlier % 60).padStart(2, '0')}`;
}
