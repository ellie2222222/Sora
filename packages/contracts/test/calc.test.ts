import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  type BalanceRelevantTransaction,
  type SpendRelevantTransaction,
  calculateAccountBalance,
  calculateBudgetRemaining,
  calculateBudgetSpent,
  calculateBudgetUsage,
  calculateGoalCurrent,
  calculateGoalProgress,
  calculateGoalRemaining,
  calculateWalletBalance,
  isBudgetTarget,
  countsAsPeriodActivity,
  isGoalReached,
  isOverBudget,
  isWithinPeriod,
  transferDirection,
  budgetWindow,
  isBudgetActiveOn,
  categorySubtreeIds,
} from '../src/calc.ts';
import { TransactionStatus, TransactionType } from '../src/enums.ts';
import { formatMoneyCompact, parseMoney } from '../src/money.ts';

/**
 * Modelled on the fixture db/tests/001_constraints.sql seeds, without the rows its
 * constraint probes add. The API's own SQL for these figures is asserted over HTTP in
 * server/test/integration.{ledger,planning}.test.ts.
 */
const VIETCOMBANK = 'a0000001';
const CASH = 'a0000002';
const TECHCOMBANK = 'b0000001';
const FOOD = 'c0000001';
const SALARY = 'c0000002';
/** Tam's wallet, which holds VIETCOMBANK and CASH; Linh's holds TECHCOMBANK. */
const TAM_WALLET = 'aaaaaaaa';
const LINH_WALLET = 'bbbbbbbb';

const ledger: BalanceRelevantTransaction[] = [
  {
    type: TransactionType.INCOME,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('15000000'),
    fromAccountId: null,
    toAccountId: VIETCOMBANK,
  },
  {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('150000'),
    fromAccountId: VIETCOMBANK,
    toAccountId: null,
  },
  {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('1000000'),
    fromAccountId: VIETCOMBANK,
    toAccountId: null,
  },
  {
    type: TransactionType.TRANSFER,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('500000'),
    fromAccountId: VIETCOMBANK,
    toAccountId: TECHCOMBANK,
  },
];

describe('calculateAccountBalance', () => {
  it("reproduces the fixture ledger's balances", () => {
    assert.equal(
      formatMoneyCompact(calculateAccountBalance(parseMoney('1000000'), ledger, VIETCOMBANK)),
      '14350000',
    );
    assert.equal(
      formatMoneyCompact(calculateAccountBalance(parseMoney('0'), ledger, TECHCOMBANK)),
      '500000',
    );
    assert.equal(
      formatMoneyCompact(calculateAccountBalance(parseMoney('500000'), ledger, CASH)),
      '500000',
    );
  });

  it('debits one side of a transfer and credits the other in one pass', () => {
    const transfer: BalanceRelevantTransaction[] = [
      {
        type: TransactionType.TRANSFER,
        status: TransactionStatus.COMPLETED,
        amount: parseMoney('2000000'),
        fromAccountId: VIETCOMBANK,
        toAccountId: CASH,
      },
    ];
    assert.equal(
      formatMoneyCompact(calculateAccountBalance(parseMoney('5000000'), transfer, VIETCOMBANK)),
      '3000000',
    );
    assert.equal(
      formatMoneyCompact(calculateAccountBalance(parseMoney('0'), transfer, CASH)),
      '2000000',
    );
  });

  it('ignores PENDING and DELETED rows', () => {
    const noise: BalanceRelevantTransaction[] = [
      {
        type: TransactionType.INCOME,
        status: TransactionStatus.PENDING,
        amount: parseMoney('9999'),
        fromAccountId: null,
        toAccountId: VIETCOMBANK,
      },
      {
        type: TransactionType.EXPENSE,
        status: TransactionStatus.DELETED,
        amount: parseMoney('8888'),
        fromAccountId: VIETCOMBANK,
        toAccountId: null,
      },
    ];
    assert.equal(
      formatMoneyCompact(calculateAccountBalance(parseMoney('100'), noise, VIETCOMBANK)),
      '100',
    );
  });

  it('lets a credit card sit negative', () => {
    assert.equal(
      formatMoneyCompact(calculateAccountBalance(parseMoney('-2000000'), [], 'visa')),
      '-2000000',
    );
  });
});

describe('calculateWalletBalance', () => {
  it('sums the accounts of one wallet', () => {
    const total = calculateWalletBalance([
      calculateAccountBalance(parseMoney('1000000'), ledger, VIETCOMBANK),
      calculateAccountBalance(parseMoney('500000'), ledger, CASH),
    ]);
    assert.equal(formatMoneyCompact(total), '14850000');
  });

  it('is zero for a wallet with no accounts', () => {
    assert.equal(formatMoneyCompact(calculateWalletBalance([])), '0');
  });
});

const spending: SpendRelevantTransaction[] = [
  {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('150000'),
    currency: 'VND',
    categoryId: FOOD,
    goalId: null,
    walletId: TAM_WALLET,
    transactionDate: '2026-08-22T12:30:00Z',
  },
  {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('1000000'),
    currency: 'VND',
    categoryId: FOOD,
    goalId: null,
    walletId: TAM_WALLET,
    transactionDate: '2026-08-10T09:00:00Z',
  },
  {
    type: TransactionType.TRANSFER,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('2000000'),
    currency: 'VND',
    categoryId: null,
    goalId: null,
    walletId: TAM_WALLET,
    transactionDate: '2026-08-15T09:00:00Z',
  },
  {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.DELETED,
    amount: parseMoney('700000'),
    currency: 'VND',
    categoryId: FOOD,
    goalId: null,
    walletId: TAM_WALLET,
    transactionDate: '2026-08-12T09:00:00Z',
  },
  {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('300000'),
    currency: 'VND',
    categoryId: FOOD,
    goalId: null,
    walletId: TAM_WALLET,
    transactionDate: '2026-09-02T09:00:00Z',
  },
  {
    type: TransactionType.INCOME,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('15000000'),
    currency: 'VND',
    categoryId: SALARY,
    goalId: null,
    walletId: null,
    transactionDate: '2026-08-01T09:00:00Z',
  },
];

const augustFood = { walletId: TAM_WALLET, categoryId: FOOD, categoryIds: [FOOD], goalId: null, currency: 'VND', startDate: '2026-08-01', endDate: '2026-08-31', timeZone: 'UTC' };

describe('calculateBudgetSpent', () => {
  it('spends 1,150,000 of the August food budget', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, spending)), '1150000');
  });

  it('excludes transfers, which is the rule the whole model turns on', () => {
    const transferOnly = spending.filter((t) => t.type === TransactionType.TRANSFER);
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, transferOnly)), '0');
  });

  it('excludes cancelled rows, other categories, other months and income', () => {
    const spent = calculateBudgetSpent(augustFood, spending);
    // 150,000 + 1,000,000 only: not the deleted 700,000, not September's
    // 300,000, not the salary.
    assert.equal(formatMoneyCompact(spent), '1150000');
  });

  it('counts an expense stamped late on the final day of the window', () => {
    const lastMoment: SpendRelevantTransaction[] = [
      {
        type: 'EXPENSE',
        status: 'COMPLETED',
        amount: parseMoney('1000'),
        currency: 'VND',
        categoryId: FOOD,
        transactionDate: '2026-08-31T23:59:59Z',
      },
    ];
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, lastMoment)), '1000');
  });

  it('ignores an expense in another currency, even in the same category and window (BR-07)', () => {
    const usd: SpendRelevantTransaction = { ...spending[0]!, currency: 'USD', amount: parseMoney('20') };
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, [...spending, usd])), '1150000');
  });
});

describe('budget remaining and usage', () => {
  const amount = parseMoney('3000000');

  it('leaves 1,850,000 remaining', () => {
    const spent = calculateBudgetSpent(augustFood, spending);
    assert.equal(formatMoneyCompact(calculateBudgetRemaining(amount, spent)), '1850000');
    assert.equal(calculateBudgetUsage(amount, spent), 38.3);
    assert.equal(isOverBudget(amount, spent), false);
  });

  it('goes negative when overspent, rather than hiding it at zero', () => {
    const spent = parseMoney('3400000');
    assert.equal(formatMoneyCompact(calculateBudgetRemaining(amount, spent)), '-400000');
    assert.equal(isOverBudget(amount, spent), true);
    assert.ok(calculateBudgetUsage(amount, spent) > 100);
  });
});

describe('goal progress', () => {
  const target = parseMoney('30000000');
  const contributions = [parseMoney('12000000'), parseMoney('1000000')];

  it('reaches 13,000,000 of 30,000,000, at 43.3%', () => {
    const current = calculateGoalCurrent(contributions);
    assert.equal(formatMoneyCompact(current), '13000000');
    assert.equal(formatMoneyCompact(calculateGoalRemaining(target, current)), '17000000');
    assert.equal(calculateGoalProgress(target, current), 43.3);
    assert.equal(isGoalReached(target, current), false);
  });

  it('floors the remainder at zero and caps progress at 100 when overshot', () => {
    const current = parseMoney('35000000');
    assert.equal(formatMoneyCompact(calculateGoalRemaining(target, current)), '0');
    assert.equal(calculateGoalProgress(target, current), 100);
    assert.equal(isGoalReached(target, current), true);
  });

  it('reports 0% for a goal with no contributions', () => {
    assert.equal(calculateGoalProgress(target, calculateGoalCurrent([])), 0);
  });
});

describe('isWithinPeriod', () => {
  it('is inclusive on both ends by calendar day', () => {
    assert.equal(isWithinPeriod('2026-08-01T00:00:00Z', '2026-08-01', '2026-08-31', 'UTC'), true);
    assert.equal(isWithinPeriod('2026-08-31T23:30:00Z', '2026-08-01', '2026-08-31', 'UTC'), true);
    assert.equal(isWithinPeriod('2026-07-31T23:59:59Z', '2026-08-01', '2026-08-31', 'UTC'), false);
    assert.equal(isWithinPeriod('2026-09-01T00:00:00Z', '2026-08-01', '2026-08-31', 'UTC'), false);
  });
});

describe('countsAsPeriodActivity', () => {
  const august = ['2026-08-01', '2026-08-31', 'UTC'] as const;
  const base = { status: TransactionStatus.COMPLETED, transactionDate: '2026-08-15T10:00:00Z' };

  it('admits completed income and expense inside the window', () => {
    assert.equal(countsAsPeriodActivity({ ...base, type: TransactionType.INCOME }, ...august), true);
    assert.equal(countsAsPeriodActivity({ ...base, type: TransactionType.EXPENSE }, ...august), true);
  });

  it('excludes a TRANSFER outright — BR-06, not netted to zero', () => {
    assert.equal(countsAsPeriodActivity({ ...base, type: TransactionType.TRANSFER }, ...august), false);
  });

  it('excludes pending and deleted rows', () => {
    const pending = { ...base, type: TransactionType.EXPENSE, status: TransactionStatus.PENDING };
    const deleted = { ...base, type: TransactionType.EXPENSE, status: TransactionStatus.DELETED };
    assert.equal(countsAsPeriodActivity(pending, ...august), false);
    assert.equal(countsAsPeriodActivity(deleted, ...august), false);
  });

  it('excludes a row outside the window', () => {
    const september = { ...base, type: TransactionType.EXPENSE, transactionDate: '2026-09-01T00:00:00Z' };
    assert.equal(countsAsPeriodActivity(september, ...august), false);
  });
});

describe('transferDirection', () => {
  // VIETCOMBANK/CASH belong to the wallet being reported on; TECHCOMBANK is
  // another person's wallet, the same split the fixture above uses.
  const ownAccounts = new Set([VIETCOMBANK, CASH]);
  const completedTransfer = { type: TransactionType.TRANSFER, status: TransactionStatus.COMPLETED };

  it('reports a cross-wallet transfer arriving as IN', () => {
    const received = { ...completedTransfer, fromAccountId: TECHCOMBANK, toAccountId: VIETCOMBANK };
    assert.equal(transferDirection(received, ownAccounts), 'IN');
  });

  it('reports a cross-wallet transfer leaving as OUT', () => {
    const sent = { ...completedTransfer, fromAccountId: VIETCOMBANK, toAccountId: TECHCOMBANK };
    assert.equal(transferDirection(sent, ownAccounts), 'OUT');
  });

  it('reports an internal transfer as neither, rather than as both', () => {
    // Bank → cash inside one wallet: counting it in *and* out would inflate
    // both figures by the same amount for money that never left the wallet.
    const internal = { ...completedTransfer, fromAccountId: VIETCOMBANK, toAccountId: CASH };
    assert.equal(transferDirection(internal, ownAccounts), null);
  });

  it('ignores a transfer that touches neither side of this wallet', () => {
    const elsewhere = { ...completedTransfer, fromAccountId: TECHCOMBANK, toAccountId: 'b0000002' };
    assert.equal(transferDirection(elsewhere, ownAccounts), null);
  });

  it('ignores income and expense — those are not transfers', () => {
    const income = { type: TransactionType.INCOME, status: TransactionStatus.COMPLETED, fromAccountId: null, toAccountId: VIETCOMBANK };
    const expense = { type: TransactionType.EXPENSE, status: TransactionStatus.COMPLETED, fromAccountId: VIETCOMBANK, toAccountId: null };
    assert.equal(transferDirection(income, ownAccounts), null);
    assert.equal(transferDirection(expense, ownAccounts), null);
  });

  it('ignores a pending or deleted transfer', () => {
    const pending = { type: TransactionType.TRANSFER, status: TransactionStatus.PENDING, fromAccountId: VIETCOMBANK, toAccountId: TECHCOMBANK };
    const deleted = { type: TransactionType.TRANSFER, status: TransactionStatus.DELETED, fromAccountId: VIETCOMBANK, toAccountId: TECHCOMBANK };
    assert.equal(transferDirection(pending, ownAccounts), null);
    assert.equal(transferDirection(deleted, ownAccounts), null);
  });
});

describe('budget and goal edges a mutation run found untested', () => {
  const inAugust = (type: TransactionType, categoryId: string): SpendRelevantTransaction => ({
    type,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('2000000'),
    currency: 'VND',
    categoryId,
    goalId: null,
    walletId: TAM_WALLET,
    transactionDate: '2026-08-15',
  });

  it('excludes a transfer or income that carries the budget category itself (BR-06)', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, [inAugust(TransactionType.TRANSFER, FOOD)])), '0');
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, [inAugust(TransactionType.INCOME, FOOD)])), '0');
  });

  it('excludes an expense in another category inside the window', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, [inAugust(TransactionType.EXPENSE, 'other')])), '0');
  });

  it('is not over budget at exactly the limit, and a goal is reached at exactly its target', () => {
    assert.equal(isOverBudget(parseMoney('100'), parseMoney('100')), false);
    assert.equal(isGoalReached(parseMoney('100'), parseMoney('100')), true);
  });

  it('compares the full calendar day, not just the month', () => {
    assert.equal(isWithinPeriod('2026-08-15T10:00:00Z', '2026-08-20', '2026-08-31', 'UTC'), false);
  });
});

describe('budget kinds (API spec §12.2)', () => {
  const GOAL = 'g0000001';
  const window = { currency: 'VND', startDate: '2026-08-01', endDate: '2026-08-31', timeZone: 'UTC' };
  const wholeWallet = { ...window, walletId: TAM_WALLET, categoryId: null, categoryIds: [], goalId: null };
  const laptop = { ...window, walletId: TAM_WALLET, categoryId: null, categoryIds: [], goalId: GOAL };
  const expense = (overrides: Partial<SpendRelevantTransaction>): SpendRelevantTransaction => ({
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('100'),
    currency: 'VND',
    categoryId: FOOD,
    goalId: null,
    walletId: TAM_WALLET,
    transactionDate: '2026-08-15T09:00:00Z',
    ...overrides,
  });

  it('BUD-US-02: counts every completed expense paid from the wallet toward a wallet-wide budget', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(wholeWallet, spending)), '1150000');
  });

  it("BUD-US-02: leaves another wallet's expenses out of a wallet-wide budget, whatever their category", () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(wholeWallet, [expense({ walletId: LINH_WALLET })])), '0');
  });

  it('BUD-US-02: never counts a transfer toward a wallet-wide budget (BR-06)', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(wholeWallet, [expense({ type: TransactionType.TRANSFER })])), '0');
  });

  it('BUD-US-02: counts only expenses tagged with the goal toward a goal budget, whatever their category', () => {
    const tagged = expense({ goalId: GOAL, categoryId: SALARY });
    assert.equal(formatMoneyCompact(calculateBudgetSpent(laptop, [tagged, expense({}), expense({ goalId: 'g-other' })])), '100');
  });

  it('BUD-US-02: lets a category budget ignore goal tags, so a tagged expense still counts in its category', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, [expense({ goalId: GOAL })])), '100');
  });

  it('decides the target by goal, then category, then wallet', () => {
    const tagged = { categoryId: FOOD, goalId: GOAL, walletId: TAM_WALLET };
    assert.equal(isBudgetTarget({ walletId: TAM_WALLET, categoryId: null, categoryIds: [], goalId: GOAL }, tagged), true);
    assert.equal(isBudgetTarget({ walletId: TAM_WALLET, categoryId: FOOD, categoryIds: [FOOD], goalId: null }, tagged), true);
    assert.equal(isBudgetTarget({ walletId: TAM_WALLET, categoryId: null, categoryIds: [], goalId: null }, tagged), true);
    assert.equal(isBudgetTarget({ walletId: LINH_WALLET, categoryId: null, categoryIds: [], goalId: null }, tagged), false);
  });
});

describe('parent-category budgets', () => {
  const COFFEE = 'c-coffee';
  const ESPRESSO = 'c-espresso';
  const tree = [
    { id: FOOD, parentId: null },
    { id: COFFEE, parentId: FOOD },
    { id: ESPRESSO, parentId: COFFEE },
    { id: SALARY, parentId: null },
  ];
  const inCategory = (categoryId: string): SpendRelevantTransaction => ({
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('100'),
    currency: 'VND',
    categoryId,
    goalId: null,
    walletId: TAM_WALLET,
    transactionDate: '2026-08-15T09:00:00Z',
  });

  it('collects a category and every descendant, and nothing outside it', () => {
    assert.deepEqual(categorySubtreeIds(FOOD, tree).sort(), [COFFEE, ESPRESSO, FOOD].sort());
    assert.deepEqual(categorySubtreeIds(COFFEE, tree).sort(), [COFFEE, ESPRESSO].sort());
    assert.deepEqual(categorySubtreeIds(SALARY, tree), [SALARY]);
  });

  it('terminates on a cycle instead of hanging the read', () => {
    const cyclic = [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }];
    assert.deepEqual(categorySubtreeIds('a', cyclic).sort(), ['a', 'b']);
  });

  it("counts subcategories' expenses toward a parent's budget, but not the reverse", () => {
    const food = { ...augustFood, categoryIds: categorySubtreeIds(FOOD, tree) };
    const coffee = { ...augustFood, categoryId: COFFEE, categoryIds: categorySubtreeIds(COFFEE, tree) };
    const spendingInTree = [inCategory(FOOD), inCategory(COFFEE), inCategory(ESPRESSO)];
    assert.equal(formatMoneyCompact(calculateBudgetSpent(food, spendingInTree)), '300');
    assert.equal(formatMoneyCompact(calculateBudgetSpent(coffee, spendingInTree)), '200');
  });

  it('still counts the budget category itself if its subtree was left empty', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent({ ...augustFood, categoryIds: [] }, [inCategory(FOOD)])), '100');
  });
});

describe('budgetWindow — repeating budgets', () => {
  const monthly = { periodType: 'MONTHLY' as const, startDate: '2026-10-01', endDate: null };

  it('follows calendar months for a monthly budget begun on the 1st, every month after', () => {
    assert.deepEqual(budgetWindow(monthly, '2026-10-15'), { startDate: '2026-10-01', endDate: '2026-10-31' });
    assert.deepEqual(budgetWindow(monthly, '2026-11-01'), { startDate: '2026-11-01', endDate: '2026-11-30' });
    assert.deepEqual(budgetWindow(monthly, '2027-02-28'), { startDate: '2027-02-01', endDate: '2027-02-28' });
  });

  it('starts a 31st-anchored month on the last day of a shorter month', () => {
    const late = { periodType: 'MONTHLY' as const, startDate: '2026-01-31', endDate: null };
    assert.deepEqual(budgetWindow(late, '2026-02-15'), { startDate: '2026-01-31', endDate: '2026-02-27' });
    assert.deepEqual(budgetWindow(late, '2026-02-28'), { startDate: '2026-02-28', endDate: '2026-03-30' });
    assert.deepEqual(budgetWindow(late, '2026-03-31'), { startDate: '2026-03-31', endDate: '2026-04-29' });
  });

  it('steps weeks and years from the start date, and gives one day for a daily budget', () => {
    const weekly = { periodType: 'WEEKLY' as const, startDate: '2026-10-05', endDate: null };
    assert.deepEqual(budgetWindow(weekly, '2026-10-14'), { startDate: '2026-10-12', endDate: '2026-10-18' });
    const yearly = { periodType: 'YEARLY' as const, startDate: '2026-01-01', endDate: null };
    assert.deepEqual(budgetWindow(yearly, '2028-06-01'), { startDate: '2028-01-01', endDate: '2028-12-31' });
    const daily = { periodType: 'DAILY' as const, startDate: '2026-10-01', endDate: null };
    assert.deepEqual(budgetWindow(daily, '2026-10-09'), { startDate: '2026-10-09', endDate: '2026-10-09' });
  });

  it('gives the first period before the budget starts, and a fixed budget its own dates', () => {
    assert.deepEqual(budgetWindow(monthly, '2026-09-20'), { startDate: '2026-10-01', endDate: '2026-10-31' });
    const custom = { periodType: 'CUSTOM' as const, startDate: '2026-10-03', endDate: '2026-10-17' };
    assert.deepEqual(budgetWindow(custom, '2027-01-01'), { startDate: '2026-10-03', endDate: '2026-10-17' });
  });

  it('counts a repeating budget active from its start onward, and a fixed one only inside its dates', () => {
    assert.equal(isBudgetActiveOn(monthly, '2030-01-01'), true);
    assert.equal(isBudgetActiveOn(monthly, '2026-09-30'), false);
    const custom = { periodType: 'CUSTOM' as const, startDate: '2026-10-03', endDate: '2026-10-17' };
    assert.deepEqual([isBudgetActiveOn(custom, '2026-10-17'), isBudgetActiveOn(custom, '2026-10-18')], [true, false]);
  });
});
