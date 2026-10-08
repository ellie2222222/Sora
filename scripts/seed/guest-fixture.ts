// Phase 9: An's own wallet from the ledger as a guest-mode `GuestData` blob (mobile/src/services/guest/
// guestStore.ts). Guest mode has one wallet and no members, so cross-wallet transfers are left out.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { STARTER_CATEGORIES, formatMoney, parseMoney, starterWalletName } from '@sora/contracts';

import type { StoryDates } from './calendar.ts';
import type { Ledger } from './ledger.ts';
import { ACCOUNTS, BUDGETS, CUSTOM_CATEGORIES, GOALS, PERSONAS, WALLETS, walletOfAccount } from './personas.ts';

/** Ids stable across runs of one SEED and anchor, in UUID shape like the app's own. */
function stableId(seed: number, anchor: string, name: string): string {
  const hex = createHash('sha256').update(`${seed}|${anchor}|${name}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Read from the app's own constant, so a bump there doesn't leave the fixture asking for a backfill. */
function starterCategoriesVersion(): number {
  const source = readFileSync(new URL('../../mobile/src/services/guest/guestSeed.ts', import.meta.url), 'utf8');
  return Number(/STARTER_CATEGORIES_VERSION = (\d+)/.exec(source)![1]);
}

export function writeGuestFixture(file: string, ledger: Ledger, dates: StoryDates, seed: number): { transactions: number } {
  const id = (name: string) => stableId(seed, dates.anchor, name);
  const now = new Date().toISOString();
  const stamp = { createdAt: now, updatedAt: now };
  const walletId = id('wallet');
  const own = (account: string | null) => account === null || walletOfAccount(account as keyof typeof ACCOUNTS).key === 'an';
  const archivedAccounts = new Set(['acb']);
  const archivedCategories = new Set(['gym']);

  const categoryId = (key: string) => id(`category:${key}`);
  const categories = [
    ...STARTER_CATEGORIES.map((category) => ({
      id: categoryId(category.key), walletId, parentId: null, systemKey: category.key, name: category.names.en,
      type: category.type, icon: category.icon, color: category.color, status: 'ACTIVE', ...stamp,
    })),
    ...CUSTOM_CATEGORIES.filter((category) => category.wallet === 'an').map((category) => ({
      id: categoryId(category.key), walletId, parentId: category.parent === null ? null : categoryId(category.parent), systemKey: null,
      name: category.name, type: category.type, icon: category.icon, color: null,
      status: archivedCategories.has(category.key) ? 'ARCHIVED' : 'ACTIVE', ...stamp,
    })),
  ];
  const transactions = ledger.rows
    .filter((row) => own(row.from) && own(row.to))
    .map((row) => ({
      id: id(`transaction:${row.id}`), type: row.type, status: row.status, amount: formatMoney(row.amount),
      currency: ACCOUNTS[(row.from ?? row.to)!].currency, description: row.description, transactionDate: row.instant, reference: row.reference,
      fromAccountId: row.from ? id(`account:${row.from}`) : null, toAccountId: row.to ? id(`account:${row.to}`) : null,
      categoryId: row.category === null ? null : categoryId(row.category), goalId: row.goal ? id(`goal:${row.goal}`) : null, ...stamp,
    }));
  const data = {
    wallet: { id: walletId, name: starterWalletName(PERSONAS.an.displayName, PERSONAS.an.locale), timeZone: WALLETS.an.timeZone, ...stamp },
    accounts: Object.values(ACCOUNTS).filter((account) => account.wallet === 'an').map((account) => ({
      id: id(`account:${account.key}`), walletId, name: account.name ?? 'Tiền mặt', type: account.type, currency: account.currency,
      initialBalance: formatMoney(parseMoney(account.opening)),
      status: archivedAccounts.has(account.key) ? 'ARCHIVED' : 'ACTIVE', ...stamp,
    })),
    categories,
    transactions,
    budgets: BUDGETS.filter((budget) => budget.wallet === 'an').map((budget) => ({
      id: id(`budget:${budget.key}`), walletId, categoryId: budget.category ? categoryId(budget.category) : null,
      goalId: budget.goal ? id(`goal:${budget.goal}`) : null, name: budget.name, amount: formatMoney(parseMoney(budget.amount)),
      currency: budget.currency, periodType: budget.periodType, startDate: budget.start(dates), endDate: budget.end(dates), ...stamp,
    })),
    goals: GOALS.filter((goal) => goal.wallet === 'an').map((goal) => ({
      id: id(`goal:${goal.key}`), walletId, name: goal.name, description: null, targetAmount: formatMoney(parseMoney(goal.target)),
      currency: goal.currency, targetDate: goal.targetDate(dates), status: goal.end, ...stamp,
    })),
    contributions: ledger.contributions
      .filter((entry) => !entry.removed && walletOfAccount(entry.account).key === 'an')
      .map((entry) => ({
        id: id(`contribution:${entry.id}`), goalId: id(`goal:${entry.goal}`), accountId: id(`account:${entry.account}`),
        transactionId: entry.row ? id(`transaction:${entry.row}`) : null, amount: formatMoney(entry.amount),
        currency: ACCOUNTS[entry.account].currency, contributionDate: entry.instant, note: null, createdAt: now,
      })),
    uploadProgress: null,
    starterCategoriesVersion: starterCategoriesVersion(),
  };
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return { transactions: transactions.length };
}
