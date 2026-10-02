import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  TransactionStatus,
  TransactionType,
  type AccountDetailResponse,
  type BudgetResponse,
  type DashboardResponse,
  type GoalResponse,
  type TransactionResponse,
  type WalletResponse,
} from '@sora/contracts';

import {
  applyContributionToGoal,
  applyNewAccountToDashboard,
  applyNewAccountToWallet,
  applyToAccount,
  applyToBudget,
  applyToDashboard,
  applyToWallet,
  ledgerChangeOf,
} from './pendingTotals.ts';

const ref = (id: string, walletId: string) => ({ id, name: id, currency: 'VND', walletId, walletName: walletId });
const food = { id: 'cat-food', name: 'Food', type: 'EXPENSE', icon: null, color: null } as TransactionResponse['category'];

function tx(overrides: Partial<TransactionResponse>): TransactionResponse {
  return {
    id: 'tx-1',
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: '100.0000',
    currency: 'VND',
    description: null,
    transactionDate: '2026-09-10T08:00:00.000Z',
    reference: null,
    fromAccount: ref('acc-bank', 'w-me'),
    toAccount: null,
    category: food,
    goalId: null,
    createdBy: { id: 'user-me', displayName: 'Me' },
    isCrossWallet: false,
    createdAt: '2026-09-10T08:00:00.000Z',
    updatedAt: '2026-09-10T08:00:00.000Z',
    ...overrides,
  };
}

function account(overrides: Partial<AccountDetailResponse> = {}): AccountDetailResponse {
  return {
    id: 'acc-bank',
    walletId: 'w-me',
    name: 'Bank',
    type: 'BANK',
    currency: 'VND',
    initialBalance: '0.0000',
    balance: '1000.0000',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: '',
    totalIncome: '0.0000',
    totalExpense: '0.0000',
    transferredIn: '0.0000',
    transferredOut: '0.0000',
    transactionCount: 3,
    ...overrides,
  } as AccountDetailResponse;
}

function budget(overrides: Partial<BudgetResponse> = {}): BudgetResponse {
  return {
    id: 'b-1',
    walletId: 'w-me',
    name: 'Food',
    amount: '1000.0000',
    currency: 'VND',
    periodType: 'MONTHLY',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    status: 'ACTIVE',
    categoryId: 'cat-food',
    goalId: null,
    category: { id: 'cat-food', name: 'Food', icon: null, color: null },
    spent: '950.0000',
    remaining: '50.0000',
    usagePercentage: 95,
    isOverBudget: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as BudgetResponse;
}

function dashboard(): DashboardResponse {
  return {
    walletId: 'w-me',
    period: { dateFrom: '2026-09-01', dateTo: '2026-09-30' },
    totalBalance: [{ currency: 'VND', amount: '1000.0000' }],
    income: [{ currency: 'VND', amount: '500.0000' }],
    expense: [{ currency: 'VND', amount: '300.0000' }],
    net: [{ currency: 'VND', amount: '200.0000' }],
    transferredIn: [],
    transferredOut: [],
    spendingByCategory: [
      { categoryId: 'cat-rent', categoryName: 'Rent', icon: null, color: null, amount: '300.0000', percentage: 100, parentId: null },
    ],
    spendingByMember: [
      { userId: 'user-me', displayName: 'Me', income: [{ currency: 'VND', amount: '500.0000' }], expense: [{ currency: 'VND', amount: '300.0000' }] },
    ],
    recentTransactions: [],
    activeBudgets: [budget()],
    activeGoals: [],
  };
}

describe('applyToAccount', () => {
  it('debits an expense and counts it', () => {
    const detail = account();
    applyToAccount(detail, ledgerChangeOf('create', tx({})));
    assert.equal(detail.balance, '900.0000');
    assert.equal(detail.totalExpense, '100.0000');
    assert.equal(detail.transactionCount, 4);
  });

  it('reverses a cancelled expense but keeps the count, as the server counts cancelled rows', () => {
    const detail = account({ balance: '900.0000', totalExpense: '100.0000' });
    applyToAccount(detail, ledgerChangeOf('cancel', tx({})));
    assert.equal(detail.balance, '1000.0000');
    assert.equal(detail.totalExpense, '0.0000');
    assert.equal(detail.transactionCount, 3);
  });

  it('moves both legs of a transfer', () => {
    const transfer = tx({ type: TransactionType.TRANSFER, category: null, toAccount: ref('acc-cash', 'w-me') });
    const bank = account();
    const cash = account({ id: 'acc-cash', balance: '0.0000' });
    applyToAccount(bank, ledgerChangeOf('create', transfer));
    applyToAccount(cash, ledgerChangeOf('create', transfer));
    assert.deepEqual([bank.balance, bank.transferredOut, cash.balance, cash.transferredIn], ['900.0000', '100.0000', '100.0000', '100.0000']);
  });

  it('counts but moves no money for a transaction that is not completed', () => {
    const detail = account();
    applyToAccount(detail, ledgerChangeOf('create', tx({ status: TransactionStatus.PENDING })));
    assert.equal(detail.balance, '1000.0000');
    assert.equal(detail.transactionCount, 4);
  });

  it('matches by the requested account id even when the account is not cached', () => {
    const detail = account();
    applyToAccount(detail, ledgerChangeOf('create', tx({ fromAccount: null }), { accountIds: { from: 'acc-bank', to: null } }));
    assert.equal(detail.balance, '900.0000');
  });

  it('keeps 4-decimal precision past float range', () => {
    const detail = account({ balance: '999999999999999.9999' });
    applyToAccount(detail, ledgerChangeOf('create', tx({ amount: '0.0001' })));
    assert.equal(detail.balance, '999999999999999.9998');
  });
});

describe('applyToWallet', () => {
  const wallet = (): WalletResponse => ({ id: 'w-me', balances: [{ currency: 'VND', amount: '1000.0000' }] }) as WalletResponse;

  it('nets an internal transfer to zero', () => {
    const w = wallet();
    applyToWallet(w, ledgerChangeOf('create', tx({ type: TransactionType.TRANSFER, toAccount: ref('acc-cash', 'w-me') })));
    assert.equal(w.balances[0]?.amount, '1000.0000');
  });

  it('credits the receiving wallet of a cross-wallet transfer and debits the sender', () => {
    const mine = wallet();
    const partner = { id: 'w-partner', balances: [] } as unknown as WalletResponse;
    const change = ledgerChangeOf('create', tx({ type: TransactionType.TRANSFER, toAccount: ref('acc-p', 'w-partner') }));
    applyToWallet(mine, change);
    applyToWallet(partner, change);
    assert.equal(mine.balances[0]?.amount, '900.0000');
    assert.deepEqual(partner.balances, [{ currency: 'VND', amount: '100.0000' }]);
  });

  it('leaves a wallet alone when the leg is not cached and its wallet unknown', () => {
    const w = wallet();
    applyToWallet(w, ledgerChangeOf('create', tx({ fromAccount: null }), { accountIds: { from: 'acc-bank', to: null } }));
    assert.equal(w.balances[0]?.amount, '1000.0000');
  });
});

describe('a new account', () => {
  const credit = { id: 'acc-new', walletId: 'w-me', currency: 'USD', initialBalance: '-250.5000' } as AccountDetailResponse;

  it('adds its signed opening balance to its wallet, in its own currency', () => {
    const w = { id: 'w-me', accountCount: 1, balances: [{ currency: 'VND', amount: '1000.0000' }] } as WalletResponse;
    applyNewAccountToWallet(w, credit);
    assert.deepEqual(w.balances, [{ currency: 'USD', amount: '-250.5000' }, { currency: 'VND', amount: '1000.0000' }]);
    assert.equal(w.accountCount, 2);
  });

  it('adds it to the dashboard balance of its wallet only', () => {
    const mine = dashboard();
    const other = { ...dashboard(), walletId: 'w-partner' };
    applyNewAccountToDashboard(mine, credit);
    applyNewAccountToDashboard(other, credit);
    assert.equal(mine.totalBalance.length, 2);
    assert.deepEqual(other.totalBalance, dashboard().totalBalance);
  });
});

describe('applyToBudget', () => {
  it('adds an in-window expense in its category and recomputes the derived fields', () => {
    const b = budget();
    applyToBudget(b, ledgerChangeOf('create', tx({})));
    assert.deepEqual([b.spent, b.remaining, b.usagePercentage, b.isOverBudget], ['1050.0000', '-50.0000', 105, true]);
  });

  it('ignores a transfer, another category, another currency and a date outside the window', () => {
    const b = budget();
    for (const other of [
      tx({ type: TransactionType.TRANSFER }),
      tx({ category: { ...food!, id: 'cat-rent' } }),
      tx({ currency: 'USD' }),
      tx({ transactionDate: '2026-10-01T00:00:00.000Z' }),
    ]) applyToBudget(b, ledgerChangeOf('create', other));
    assert.equal(b.spent, '950.0000');
  });

  it('counts an expense stamped late on the last day of the window', () => {
    const b = budget();
    applyToBudget(b, ledgerChangeOf('create', tx({ transactionDate: '2026-09-30T23:30:00.000Z' })));
    assert.equal(b.spent, '1050.0000');
  });
  it('BUD-US-02: counts any expense paid from the wallet toward a wallet-wide budget, and none from another wallet', () => {
    const b = budget({ categoryId: null, category: null, goalId: null });
    applyToBudget(b, ledgerChangeOf('create', tx({ category: { ...food!, id: 'cat-rent' } })));
    applyToBudget(b, ledgerChangeOf('create', tx({ fromAccount: ref('acc-partner', 'w-partner') })));
    assert.equal(b.spent, '1050.0000');
  });

  it('BUD-US-02: counts only expenses tagged with the goal toward a goal budget', () => {
    const b = budget({ categoryId: null, category: null, goalId: 'goal-laptop', periodType: 'GOAL' });
    applyToBudget(b, ledgerChangeOf('create', tx({ goalId: 'goal-laptop' })));
    applyToBudget(b, ledgerChangeOf('create', tx({ goalId: null })));
    assert.equal(b.spent, '1050.0000');
  });
});

describe('applyContributionToGoal', () => {
  it('grows the goal, caps progress at 100 and floors the gap at zero', () => {
    const goal = { id: 'g-1', targetAmount: '1000.0000', currentAmount: '900.0000', remaining: '100.0000', progressPercentage: 90, contributionCount: 2 } as GoalResponse;
    applyContributionToGoal(goal, 'g-1', '300.0000');
    assert.deepEqual([goal.currentAmount, goal.remaining, goal.progressPercentage, goal.contributionCount], ['1200.0000', '0.0000', 100, 3]);
  });

  it('leaves other goals alone', () => {
    const goal = { id: 'g-2', targetAmount: '1000.0000', currentAmount: '0.0000', remaining: '1000.0000', progressPercentage: 0, contributionCount: 0 } as GoalResponse;
    applyContributionToGoal(goal, 'g-1', '300.0000');
    assert.equal(goal.currentAmount, '0.0000');
  });
});

describe('applyToDashboard', () => {
  it('moves balance, expense, net, the member, the category split and the active budget', () => {
    const d = dashboard();
    const expense = tx({});
    applyToDashboard(d, ledgerChangeOf('create', expense, { actorUserId: 'user-me' }));
    assert.equal(d.totalBalance[0]?.amount, '900.0000');
    assert.equal(d.expense[0]?.amount, '400.0000');
    assert.equal(d.net[0]?.amount, '100.0000');
    assert.equal(d.spendingByMember[0]?.expense[0]?.amount, '400.0000');
    assert.deepEqual(
      d.spendingByCategory.map((slice) => [slice.categoryId, slice.amount, slice.percentage]),
      [['cat-rent', '300.0000', 75], ['cat-food', '100.0000', 25]],
    );
    assert.equal(d.activeBudgets[0]?.spent, '1050.0000');
    assert.equal(d.recentTransactions[0]?.id, 'tx-1');
  });

  it('undoes itself exactly when the same transaction is cancelled', () => {
    const d = dashboard();
    const expense = tx({});
    applyToDashboard(d, ledgerChangeOf('create', expense, { actorUserId: 'user-me' }));
    applyToDashboard(d, ledgerChangeOf('cancel', { ...expense }, { actorUserId: 'user-me' }));
    const fresh = dashboard();
    assert.deepEqual(
      { ...d, recentTransactions: [] },
      { ...fresh, recentTransactions: [] },
    );
    assert.equal(d.recentTransactions[0]?.status, TransactionStatus.DELETED);
  });

  it('keeps an internal transfer out of every figure but reports a cross-wallet one on its own (BR-06)', () => {
    const internal = dashboard();
    applyToDashboard(internal, ledgerChangeOf('create', tx({ type: TransactionType.TRANSFER, category: null, toAccount: ref('acc-cash', 'w-me') })));
    assert.deepEqual([internal.totalBalance, internal.transferredIn, internal.transferredOut, internal.expense], [
      dashboard().totalBalance, [], [], dashboard().expense,
    ]);

    const outgoing = dashboard();
    applyToDashboard(outgoing, ledgerChangeOf('create', tx({ type: TransactionType.TRANSFER, category: null, toAccount: ref('acc-p', 'w-partner') })));
    assert.deepEqual(outgoing.transferredOut, [{ currency: 'VND', amount: '100.0000' }]);
    assert.equal(outgoing.expense[0]?.amount, '300.0000');
    assert.equal(outgoing.totalBalance[0]?.amount, '900.0000');
  });

  it('moves the balance but not the period figures for a transaction outside the period', () => {
    const d = dashboard();
    applyToDashboard(d, ledgerChangeOf('create', tx({ transactionDate: '2026-08-31T12:00:00.000Z' })));
    assert.equal(d.totalBalance[0]?.amount, '900.0000');
    assert.equal(d.expense[0]?.amount, '300.0000');
  });

  it('ignores a transaction in another wallet', () => {
    const d = dashboard();
    applyToDashboard(d, ledgerChangeOf('create', tx({ fromAccount: ref('acc-p', 'w-partner') })));
    assert.deepEqual(d, dashboard());
  });

  it('leaves the category split alone for an expense in a non-dominant currency', () => {
    const d = dashboard();
    applyToDashboard(d, ledgerChangeOf('create', tx({ currency: 'USD', amount: '5.0000' })));
    assert.deepEqual(d.expense, [{ currency: 'USD', amount: '5.0000' }, { currency: 'VND', amount: '300.0000' }]);
    assert.deepEqual(d.spendingByCategory, dashboard().spendingByCategory);
    assert.deepEqual(d.net, [{ currency: 'USD', amount: '-5.0000' }, { currency: 'VND', amount: '200.0000' }]);
  });
});
