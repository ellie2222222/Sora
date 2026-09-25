/**
 * Derived balances.
 *
 * Nothing here is stored. Every figure is recomputed from transaction rows by
 * `calculateAccountBalance` / `calculateWalletBalance` in @sora/contracts —
 * the same functions the mobile app uses for optimistic values — rather than by
 * a SQL `SUM`. A SQL aggregate would be a second implementation of the rule
 * "only COMPLETED transactions move a balance, and direction comes from which
 * side names the account", and the two would eventually classify a transfer
 * differently. The cost is that the rows are read rather than folded in the
 * database; at a personal-finance row count that is the right trade.
 */

import { Injectable } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';

import {
  ZERO,
  add,
  calculateAccountBalance,
  formatMoney,
  parseMoney,
  TransactionStatus,
  TransactionType,
  type BalanceRelevantTransaction,
  type CurrencyTotal,
  type MoneyString,
  type Scaled,
} from '@sora/contracts';

import { CurrencyLedger } from '../common/currency-totals.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { DB } from '../database/types.ts';

type Executor = Kysely<DB> | Transaction<DB>;

export interface AccountBalance {
  accountId: string;
  walletId: string;
  currency: string;
  initialBalance: Scaled;
  balance: Scaled;
}

export interface AccountActivity {
  totalIncome: MoneyString;
  totalExpense: MoneyString;
  transferredIn: MoneyString;
  transferredOut: MoneyString;
  transactionCount: number;
}

@Injectable()
export class BalanceService {
  constructor(private readonly database: DatabaseService) {}

  private executor(given?: Executor): Executor {
    return given ?? this.database.db;
  }

  /**
   * Balances for every account in the given wallets, keyed by account id.
   *
   * The transaction fetch is not restricted to those wallets' accounts on the
   * `to` side only: a cross-wallet transfer's other leg lives in a different
   * wallet, and dropping it would leave one side of a real movement of money
   * uncounted.
   */
  async balancesForWallets(
    walletIds: readonly string[],
    executor?: Executor,
  ): Promise<Map<string, AccountBalance>> {
    if (walletIds.length === 0) return new Map();

    const db = this.executor(executor);

    const accounts = await db
      .selectFrom('accounts')
      .select(['id', 'wallet_id', 'currency', 'initial_balance'])
      .where('wallet_id', 'in', [...walletIds])
      .execute();

    return this.balancesForAccounts(accounts, executor);
  }

  async balanceForAccount(
    account: { id: string; wallet_id: string; currency: string; initial_balance: string },
    executor?: Executor,
  ): Promise<AccountBalance> {
    const balances = await this.balancesForAccounts([account], executor);
    return (
      balances.get(account.id) ?? {
        accountId: account.id,
        walletId: account.wallet_id,
        currency: account.currency,
        initialBalance: parseMoney(account.initial_balance),
        balance: parseMoney(account.initial_balance),
      }
    );
  }

  private async balancesForAccounts(
    accounts: readonly { id: string; wallet_id: string; currency: string; initial_balance: string }[],
    executor?: Executor,
  ): Promise<Map<string, AccountBalance>> {
    const result = new Map<string, AccountBalance>();
    if (accounts.length === 0) return result;

    const accountIds = accounts.map((account) => account.id);
    const movements = await this.movementsTouching(accountIds, executor);

    for (const account of accounts) {
      const initialBalance = parseMoney(account.initial_balance);
      result.set(account.id, {
        accountId: account.id,
        walletId: account.wallet_id,
        currency: account.currency,
        initialBalance,
        balance: calculateAccountBalance(initialBalance, movements, account.id),
      });
    }

    return result;
  }

  /**
   * Every transaction naming one of these accounts, in the shape calc.ts wants.
   *
   * Status is not filtered in SQL: `affectsBalance` inside
   * `calculateAccountBalance` is what decides, and filtering here as well would
   * put the same rule in two places.
   */
  private async movementsTouching(
    accountIds: readonly string[],
    executor?: Executor,
  ): Promise<BalanceRelevantTransaction[]> {
    const rows = await this.executor(executor)
      .selectFrom('transactions')
      .select(['type', 'status', 'amount', 'from_account_id', 'to_account_id'])
      .where((eb) =>
        eb.or([
          eb('from_account_id', 'in', [...accountIds]),
          eb('to_account_id', 'in', [...accountIds]),
        ]),
      )
      .execute();

    return rows.map((row) => ({
      type: row.type,
      status: row.status,
      amount: parseMoney(row.amount),
      fromAccountId: row.from_account_id,
      toAccountId: row.to_account_id,
    }));
  }

  /** Per-currency wallet totals, for WalletResponse.balances. */
  async walletBalances(
    walletIds: readonly string[],
    executor?: Executor,
  ): Promise<Map<string, CurrencyTotal[]>> {
    const balances = await this.balancesForWallets(walletIds, executor);
    const ledgers = new Map<string, CurrencyLedger>();

    for (const walletId of walletIds) ledgers.set(walletId, new CurrencyLedger());

    for (const balance of balances.values()) {
      const ledger = ledgers.get(balance.walletId);
      if (!ledger) continue;
      ledger.addTo(balance.currency, balance.balance);
    }

    return new Map([...ledgers].map(([walletId, ledger]) => [walletId, ledger.toArray()]));
  }

  /**
   * Income, expense and the two transfer directions, reported separately.
   *
   * Transfers are never folded into income or expense: `totalExpense` answers
   * "what did this person spend", and money moved to their own cash account or
   * to a partner's wallet is not spending (§9.3).
   */
  async activityForAccount(accountId: string, executor?: Executor): Promise<AccountActivity> {
    const rows = await this.executor(executor)
      .selectFrom('transactions')
      .select(['type', 'status', 'amount', 'from_account_id', 'to_account_id'])
      .where((eb) =>
        eb.or([eb('from_account_id', '=', accountId), eb('to_account_id', '=', accountId)]),
      )
      .execute();

    let totalIncome = ZERO;
    let totalExpense = ZERO;
    let transferredIn = ZERO;
    let transferredOut = ZERO;

    for (const row of rows) {
      if (row.status !== TransactionStatus.COMPLETED) continue;
      const amount = parseMoney(row.amount);

      if (row.type === TransactionType.INCOME && row.to_account_id === accountId) {
        totalIncome = add(totalIncome, amount);
      } else if (row.type === TransactionType.EXPENSE && row.from_account_id === accountId) {
        totalExpense = add(totalExpense, amount);
      } else if (row.type === TransactionType.TRANSFER) {
        if (row.to_account_id === accountId) transferredIn = add(transferredIn, amount);
        if (row.from_account_id === accountId) transferredOut = add(transferredOut, amount);
      }
    }

    return {
      totalIncome: formatMoney(totalIncome),
      totalExpense: formatMoney(totalExpense),
      transferredIn: formatMoney(transferredIn),
      transferredOut: formatMoney(transferredOut),
      // Counts every row on the ledger, deleted included: a deleted entry is
      // still a visible record of what happened (§16.3).
      transactionCount: rows.length,
    };
  }
}
