/**
 * Guest-mode wallets repository — the local mirror of `walletsApi`, scoped
 * to `list()`/`detail()` only. Guest mode is single-wallet by scope decision
 * (HANDOFF.md): no create/update/archive, and no real membership to manage
 * since the wallet has exactly one (fabricated) member.
 */

import {
  calculateAccountBalance,
  calculateWalletBalance,
  formatMoney,
  parseMoney,
  WalletStatus,
  WalletRole,
  type CurrencyTotal,
  type WalletResponse,
} from '@sora/contracts';

import { guestError } from './guestErrors.ts';
import { GUEST_USER_ID } from './guestIds.ts';
import { guestStore } from './guestStorage.ts';
import { type GuestAccount, type GuestTransaction, type GuestWallet } from './guestStore.ts';
import { toBalanceRelevant } from './guestTransactions.ts';

export interface WalletListQuery {
  status?: WalletStatus | undefined;
  includeOwn?: boolean;
  includeShared?: boolean;
}

function requireWallet(): GuestWallet {
  const wallet = guestStore.current().wallet;
  if (!wallet) throw guestError('WALLET_NOT_FOUND');
  return wallet;
}

/** Per-currency totals — a wallet may hold accounts in more than one currency (BR-07). */
function balancesByCurrency(
  accounts: readonly GuestAccount[],
  transactions: readonly GuestTransaction[],
): CurrencyTotal[] {
  const relevant = transactions.map(toBalanceRelevant);
  const byCurrency = new Map<string, bigint[]>();

  for (const account of accounts) {
    const balance = calculateAccountBalance(parseMoney(account.initialBalance), relevant, account.id);
    const list = byCurrency.get(account.currency) ?? [];
    list.push(balance);
    byCurrency.set(account.currency, list);
  }

  return [...byCurrency.keys()]
    .sort()
    .map((currency) => ({ currency, amount: formatMoney(calculateWalletBalance(byCurrency.get(currency)!)) }));
}

function toWalletResponse(
  wallet: GuestWallet,
  accounts: readonly GuestAccount[],
  transactions: readonly GuestTransaction[],
): WalletResponse {
  return {
    id: wallet.id,
    name: wallet.name,
    status: WalletStatus.ACTIVE,
    ownerUserId: GUEST_USER_ID,
    role: WalletRole.OWNER,
    relationLabel: null,
    isOwn: true,
    memberCount: 1,
    accountCount: accounts.length,
    balances: balancesByCurrency(accounts, transactions),
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
  };
}

export const guestWalletsApi = {
  async list(query: WalletListQuery = {}): Promise<WalletResponse[]> {
    const wallet = requireWallet();
    // Guest mode's wallet is never archived and never shared — a filter
    // asking for anything else than the active, own set matches nothing.
    if (query.status && query.status !== WalletStatus.ACTIVE) return [];

    const { accounts, transactions } = guestStore.current();
    return [toWalletResponse(wallet, accounts, transactions)];
  },

  async detail(walletId: string): Promise<WalletResponse> {
    const wallet = requireWallet();
    if (wallet.id !== walletId) throw guestError('WALLET_NOT_FOUND');

    const { accounts, transactions } = guestStore.current();
    return toWalletResponse(wallet, accounts, transactions);
  },
};
