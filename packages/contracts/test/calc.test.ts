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
  isGoalReached,
  isOverBudget,
  isWithinPeriod,
} from '../src/calc.ts';
import { TransactionStatus, TransactionType } from '../src/enums.ts';
import { formatMoneyCompact, parseMoney } from '../src/money.ts';

/**
 * The same fixture db/tests/001_constraints.sql builds, so these assertions and
 * the SQL suite are two independent computations of one set of figures. If the
 * TypeScript and the database ever disagree, one of the two suites goes red.
 */
const VIETCOMBANK = 'a0000001';
const CASH = 'a0000002';
const TECHCOMBANK = 'b0000001';
const FOOD = 'c0000001';
const SALARY = 'c0000002';

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
  it('reproduces the figures the SQL suite reports', () => {
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

  it('ignores PENDING and CANCELLED rows', () => {
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
        status: TransactionStatus.CANCELLED,
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
    categoryId: FOOD,
    transactionDate: '2026-08-22T12:30:00Z',
  },
  {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('1000000'),
    categoryId: FOOD,
    transactionDate: '2026-08-10T09:00:00Z',
  },
  {
    type: TransactionType.TRANSFER,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('2000000'),
    categoryId: null,
    transactionDate: '2026-08-15T09:00:00Z',
  },
  {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.CANCELLED,
    amount: parseMoney('700000'),
    categoryId: FOOD,
    transactionDate: '2026-08-12T09:00:00Z',
  },
  {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('300000'),
    categoryId: FOOD,
    transactionDate: '2026-09-02T09:00:00Z',
  },
  {
    type: TransactionType.INCOME,
    status: TransactionStatus.COMPLETED,
    amount: parseMoney('15000000'),
    categoryId: SALARY,
    transactionDate: '2026-08-01T09:00:00Z',
  },
];

const augustFood = { categoryId: FOOD, startDate: '2026-08-01', endDate: '2026-08-31' };

describe('calculateBudgetSpent', () => {
  it('matches the SQL suite: 1,150,000 spent of the August food budget', () => {
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, spending)), '1150000');
  });

  it('excludes transfers, which is the rule the whole model turns on', () => {
    const transferOnly = spending.filter((t) => t.type === TransactionType.TRANSFER);
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, transferOnly)), '0');
  });

  it('excludes cancelled rows, other categories, other months and income', () => {
    const spent = calculateBudgetSpent(augustFood, spending);
    // 150,000 + 1,000,000 only: not the cancelled 700,000, not September's
    // 300,000, not the salary.
    assert.equal(formatMoneyCompact(spent), '1150000');
  });

  it('counts an expense stamped late on the final day of the window', () => {
    const lastMoment: SpendRelevantTransaction[] = [
      {
        type: 'EXPENSE',
        status: 'COMPLETED',
        amount: parseMoney('1000'),
        categoryId: FOOD,
        transactionDate: '2026-08-31T23:59:59Z',
      },
    ];
    assert.equal(formatMoneyCompact(calculateBudgetSpent(augustFood, lastMoment)), '1000');
  });
});

describe('budget remaining and usage', () => {
  const amount = parseMoney('3000000');

  it('matches the SQL suite: 1,850,000 remaining', () => {
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

  it('matches the SQL suite: 13,000,000 of 30,000,000 at 43.3%', () => {
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
    assert.equal(isWithinPeriod('2026-08-01T00:00:00Z', '2026-08-01', '2026-08-31'), true);
    assert.equal(isWithinPeriod('2026-08-31T23:30:00Z', '2026-08-01', '2026-08-31'), true);
    assert.equal(isWithinPeriod('2026-07-31T23:59:59Z', '2026-08-01', '2026-08-31'), false);
    assert.equal(isWithinPeriod('2026-09-01T00:00:00Z', '2026-08-01', '2026-08-31'), false);
  });
});
