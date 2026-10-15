import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { TransactionResponse } from '@sora/contracts';

import { fitsListFilters, fitsTransactionList } from './listFit.ts';

const VN = 'Asia/Ho_Chi_Minh';
const zoneOf = () => VN;

const expense: TransactionResponse = {
  id: 'local-1',
  type: 'EXPENSE',
  status: 'ACTIVE',
  amount: '150000.0000',
  currency: 'VND',
  description: 'Lunch with Linh',
  // 23:30 on Oct 31 UTC is Nov 1 in Ho Chi Minh City.
  transactionDate: '2026-10-31T23:30:00.000Z',
  reference: null,
  fromAccount: { id: 'cash', name: 'Cash', currency: 'VND', walletId: 'wallet-a', walletName: 'A' },
  toAccount: null,
  category: { id: 'food', name: 'Food', type: 'EXPENSE', icon: null, color: null },
  goalId: null,
  backsContribution: false,
  createdBy: { id: 'user-a', displayName: 'A' },
  isCrossWallet: false,
  createdAt: '2026-10-31T23:30:00.000Z',
  updatedAt: '2026-10-31T23:30:00.000Z',
};

describe('fitsTransactionList', () => {
  it('fits the lists the server would put it in', () => {
    for (const args of [undefined, {}, { walletId: 'wallet-a' }, { accountId: 'cash', type: 'EXPENSE' as const }, { dateFrom: '2026-11-01', dateTo: '2026-11-30' }, { search: 'linh' }, { minAmount: '150000' }]) {
      assert.equal(fitsTransactionList(expense, args, zoneOf), true, JSON.stringify(args));
    }
  });

  it('stays out of another wallet, account, category, type, month, amount range or search', () => {
    for (const args of [
      { walletId: 'wallet-b' },
      { accountId: 'bank' },
      { categoryId: 'rent' },
      { type: 'INCOME' as const },
      { status: 'DELETED' as const },
      { dateFrom: '2026-10-01', dateTo: '2026-10-31' },
      { maxAmount: '100000' },
      { search: 'rent' },
    ]) {
      assert.equal(fitsTransactionList(expense, args, zoneOf), false, JSON.stringify(args));
    }
  });
});

describe('fitsListFilters', () => {
  it('matches equality filters both sides name, and ignores paging and fields the record lacks', () => {
    const account = { id: 'cash', walletId: 'wallet-a', status: 'ACTIVE', type: 'CASH' };
    assert.equal(fitsListFilters(account, { walletId: 'wallet-a', status: 'ACTIVE', page: 1 }), true);
    assert.equal(fitsListFilters(account, { walletId: 'wallet-b' }), false);
    assert.equal(fitsListFilters(account, { type: 'BANK_ACCOUNT' }), false);
    assert.equal(fitsListFilters({ id: 'goal', walletId: 'wallet-a' }, { walletId: 'wallet-a', parentId: 'x' }), true);
  });
});
