import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { CategoryStatus, CategoryType } from '@sora/contracts';

import { guestBudgetsApi } from './guestBudgets.ts';
import { guestCategoriesApi } from './guestCategories.ts';
import { guestStore } from './guestStorage.ts';
import type { GuestCategory } from './guestStore.ts';
import { guestTransactionsApi } from './guestTransactions.ts';
import { ACCOUNT_ID, codeOf, EXPENSE_CATEGORY_ID, seedFixture, WALLET_ID, withFreshStore } from './testSupport.ts';

const NOW = '2026-09-01T00:00:00.000Z';

function category(id: string, name: string, parentId: string | null): GuestCategory {
  return {
    id,
    walletId: WALLET_ID,
    parentId,
    name,
    type: CategoryType.EXPENSE,
    icon: null,
    color: null,
    status: CategoryStatus.ACTIVE,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function addCategories(...extra: GuestCategory[]): Promise<void> {
  await guestStore.mutate((data) => ({ ...data, categories: [...data.categories, ...extra] }));
}

function statusOf(categoryId: string): CategoryStatus | undefined {
  return guestStore.current().categories.find((candidate) => candidate.id === categoryId)?.status;
}

const CHILD_ID = '3f1a7c62-0000-4000-8000-000000000020';
const GRANDCHILD_ID = '3f1a7c62-0000-4000-8000-000000000021';

beforeEach(async () => {
  await withFreshStore();
  await seedFixture();
});

describe('guestCategoriesApi.create — names', () => {
  it('rejects a sibling name that differs only by case or surrounding space', async () => {
    const lower = await codeOf(() => guestCategoriesApi.create({ walletId: WALLET_ID, name: 'food', type: 'EXPENSE' }));
    const padded = await codeOf(() => guestCategoriesApi.create({ walletId: WALLET_ID, name: '  FOOD ', type: 'EXPENSE' }));

    assert.equal(lower, 'CATEGORY_DUPLICATE_NAME');
    assert.equal(padded, 'CATEGORY_DUPLICATE_NAME');
  });

  it('scopes uniqueness by parent but not by type, as uq_category_name_per_parent does', async () => {
    const acrossTypes = await codeOf(() =>
      guestCategoriesApi.create({ walletId: WALLET_ID, name: 'salary', type: 'EXPENSE' }),
    );
    const underParent = await guestCategoriesApi.create({
      walletId: WALLET_ID,
      parentId: EXPENSE_CATEGORY_ID,
      name: 'Food',
      type: 'EXPENSE',
    });

    assert.equal(acrossTypes, 'CATEGORY_DUPLICATE_NAME');
    assert.equal(underParent.parentId, EXPENSE_CATEGORY_ID);
  });

  it('rejects a child whose type differs from its parent', async () => {
    const code = await codeOf(() =>
      guestCategoriesApi.create({ walletId: WALLET_ID, parentId: EXPENSE_CATEGORY_ID, name: 'Bonus', type: 'INCOME' }),
    );
    assert.equal(code, 'CATEGORY_WRONG_TYPE');
  });
});

describe('guestCategoriesApi.create — cycles', () => {
  // The update schema cannot re-parent, so a cycle can only already exist in stored data.
  it('refuses to attach under a parent chain that loops back on itself', async () => {
    await addCategories(category(CHILD_ID, 'Loop A', GRANDCHILD_ID), category(GRANDCHILD_ID, 'Loop B', CHILD_ID));

    const code = await codeOf(() =>
      guestCategoriesApi.create({ walletId: WALLET_ID, parentId: CHILD_ID, name: 'Leaf', type: 'EXPENSE' }),
    );
    assert.equal(code, 'CATEGORY_CYCLE');
  });
});

describe('guestCategoriesApi.update — names', () => {
  it('rejects a rename onto a sibling but allows re-casing its own name', async () => {
    const created = await guestCategoriesApi.create({ walletId: WALLET_ID, name: 'Rent', type: 'EXPENSE' });

    const collision = await codeOf(() => guestCategoriesApi.update(created.id, { name: 'FOOD' }));
    const recased = await guestCategoriesApi.update(created.id, { name: 'RENT' });

    assert.equal(collision, 'CATEGORY_DUPLICATE_NAME');
    assert.equal(recased.name, 'RENT');
  });
});

describe('guestCategoriesApi.archive', () => {
  const budget = {
    walletId: WALLET_ID,
    categoryId: EXPENSE_CATEGORY_ID,
    name: 'Food, September',
    amount: '1000000',
    currency: 'VND',
    periodType: 'CUSTOM' as const,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  };

  it('refuses while an active budget still references the category', async () => {
    await guestBudgetsApi.create(budget);

    assert.equal(await codeOf(() => guestCategoriesApi.archive(EXPENSE_CATEGORY_ID)), 'CATEGORY_IN_USE');
    assert.equal(statusOf(EXPENSE_CATEGORY_ID), CategoryStatus.ACTIVE);
  });

  it('proceeds once that budget is deleted', async () => {
    const created = await guestBudgetsApi.create(budget);
    await guestBudgetsApi.delete(created.id);

    await guestCategoriesApi.archive(EXPENSE_CATEGORY_ID);
    assert.equal(statusOf(EXPENSE_CATEGORY_ID), CategoryStatus.ARCHIVED);
  });

  it('archives the whole subtree with the category', async () => {
    await addCategories(category(CHILD_ID, 'Groceries', EXPENSE_CATEGORY_ID), category(GRANDCHILD_ID, 'Fruit', CHILD_ID));

    await guestCategoriesApi.archive(EXPENSE_CATEGORY_ID);

    assert.equal(statusOf(CHILD_ID), CategoryStatus.ARCHIVED);
    assert.equal(statusOf(GRANDCHILD_ID), CategoryStatus.ARCHIVED);
  });

  it('applies the same refusal and cascade when archived through update', async () => {
    await addCategories(category(CHILD_ID, 'Groceries', EXPENSE_CATEGORY_ID));
    const created = await guestBudgetsApi.create(budget);
    const archiveByUpdate = () => guestCategoriesApi.update(EXPENSE_CATEGORY_ID, { status: CategoryStatus.ARCHIVED });

    assert.equal(await codeOf(archiveByUpdate), 'CATEGORY_IN_USE');
    assert.equal(statusOf(CHILD_ID), CategoryStatus.ACTIVE);

    await guestBudgetsApi.delete(created.id);
    await archiveByUpdate();
    assert.deepEqual([statusOf(EXPENSE_CATEGORY_ID), statusOf(CHILD_ID)], [CategoryStatus.ARCHIVED, CategoryStatus.ARCHIVED]);
  });

  it('refuses archiving a parent while an active budget plans for one of its children', async () => {
    await addCategories(category(CHILD_ID, 'Groceries', EXPENSE_CATEGORY_ID));
    await guestBudgetsApi.create({ ...budget, categoryId: CHILD_ID });

    assert.equal(await codeOf(() => guestCategoriesApi.archive(EXPENSE_CATEGORY_ID)), 'CATEGORY_IN_USE');
    assert.equal(await codeOf(() => guestCategoriesApi.update(EXPENSE_CATEGORY_ID, { status: CategoryStatus.ARCHIVED })), 'CATEGORY_IN_USE');
    assert.deepEqual([statusOf(EXPENSE_CATEGORY_ID), statusOf(CHILD_ID)], [CategoryStatus.ACTIVE, CategoryStatus.ACTIVE]);
  });

  it('refuses restoring a child while its parent is archived', async () => {
    await addCategories(category(CHILD_ID, 'Groceries', EXPENSE_CATEGORY_ID));
    await guestCategoriesApi.archive(EXPENSE_CATEGORY_ID);
    const restore = (id: string) => guestCategoriesApi.update(id, { status: CategoryStatus.ACTIVE });

    assert.equal(await codeOf(() => restore(CHILD_ID)), 'CATEGORY_PARENT_ARCHIVED');
    await restore(EXPENSE_CATEGORY_ID);
    await restore(CHILD_ID);
    assert.equal(statusOf(CHILD_ID), CategoryStatus.ACTIVE);
  });
});

describe('guestCategoriesApi.deletePermanently', () => {
  it('refuses while the category has transactions', async () => {
    await guestTransactionsApi.create({
      type: 'EXPENSE',
      fromAccountId: ACCOUNT_ID,
      categoryId: EXPENSE_CATEGORY_ID,
      amount: '150000',
      currency: 'VND',
      transactionDate: '2026-09-05T10:00:00.000Z',
      status: 'COMPLETED',
    });

    assert.equal(await codeOf(() => guestCategoriesApi.deletePermanently(EXPENSE_CATEGORY_ID)), 'CATEGORY_HAS_TRANSACTIONS');
    assert.equal(statusOf(EXPENSE_CATEGORY_ID), CategoryStatus.ACTIVE);
  });

  it('refuses while any descendant has transactions', async () => {
    await addCategories(category(CHILD_ID, 'Groceries', EXPENSE_CATEGORY_ID));
    await guestTransactionsApi.create({
      type: 'EXPENSE',
      fromAccountId: ACCOUNT_ID,
      categoryId: CHILD_ID,
      amount: '1000',
      currency: 'VND',
      transactionDate: '2026-09-05T10:00:00.000Z',
      status: 'COMPLETED',
    });

    assert.equal(await codeOf(() => guestCategoriesApi.deletePermanently(EXPENSE_CATEGORY_ID)), 'CATEGORY_HAS_TRANSACTIONS');
  });

  it('removes the category and its subtree when nothing references them', async () => {
    await addCategories(category(CHILD_ID, 'Groceries', EXPENSE_CATEGORY_ID), category(GRANDCHILD_ID, 'Fruit', CHILD_ID));

    await guestCategoriesApi.deletePermanently(EXPENSE_CATEGORY_ID);

    const remaining = guestStore.current().categories.map((candidate) => candidate.id);
    assert.equal(remaining.includes(EXPENSE_CATEGORY_ID), false);
    assert.equal(remaining.includes(CHILD_ID), false);
    assert.equal(remaining.includes(GRANDCHILD_ID), false);
  });
});
