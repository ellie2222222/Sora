import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { CategoryType } from '@sora/contracts';

import { setActiveLocale } from '../locale/activeLocale.ts';
import { guestCategoriesApi } from './guestCategories.ts';
import { ensureSeeded, GUEST_WALLET_NAME } from './guestSeed.ts';
import { guestStore } from './guestStorage.ts';
import { codeOf, EXPENSE_CATEGORY_ID, seedFixture, WALLET_ID, withFreshStore } from './testSupport.ts';

beforeEach(async () => {
  await withFreshStore();
});

afterEach(() => {
  setActiveLocale('en');
});

async function namedInList(name: string) {
  return (await guestCategoriesApi.list({ walletId: WALLET_ID })).find((category) => category.name === name);
}

describe('guest starter-category names', () => {
  it('shows a starter category in the active language and a custom one as typed', async () => {
    await ensureSeeded();
    await guestCategoriesApi.create({ walletId: WALLET_ID, name: 'Tiền chợ', type: CategoryType.EXPENSE });

    setActiveLocale('vi');
    const food = await namedInList('Ăn uống');
    assert.equal(food?.systemKey, 'food');
    assert.equal((await namedInList('Tiền chợ'))?.systemKey, null);

    setActiveLocale('en');
    assert.equal((await namedInList('Food'))?.id, food?.id);
    assert.ok(await namedInList('Tiền chợ'));
  });

  it('rejects a custom name that matches a starter as the guest reads it', async () => {
    await ensureSeeded();
    setActiveLocale('vi');

    assert.equal(
      await codeOf(() => guestCategoriesApi.create({ walletId: WALLET_ID, name: 'ăn uống', type: CategoryType.EXPENSE })),
      'CATEGORY_DUPLICATE_NAME',
    );
  });

  it("rejects a starter's stored English name even while it reads in another language, so the upload can't collide", async () => {
    await ensureSeeded();
    setActiveLocale('vi');

    assert.equal(
      await codeOf(() => guestCategoriesApi.create({ walletId: WALLET_ID, name: 'Food', type: CategoryType.EXPENSE })),
      'CATEGORY_DUPLICATE_NAME',
    );
  });

  it('keeps a starter translatable when an edit sends back its displayed name, and makes it custom on a real rename', async () => {
    await ensureSeeded();
    setActiveLocale('vi');
    const food = (await namedInList('Ăn uống'))!;

    const recoloured = await guestCategoriesApi.update(food.id, { name: 'Ăn uống', color: '#000000' });
    assert.equal(recoloured.systemKey, 'food');

    const renamed = await guestCategoriesApi.update(food.id, { name: 'Đồ ăn' });
    assert.equal(renamed.systemKey, null);
    setActiveLocale('en');
    assert.ok(await namedInList('Đồ ăn'));
  });

  it('seeds the Cash account in the active language and keeps the wallet name a marker the screens translate', async () => {
    setActiveLocale('vi');
    await ensureSeeded();

    const { wallet, accounts } = guestStore.current();
    assert.equal(wallet?.name, GUEST_WALLET_NAME);
    assert.deepEqual(accounts.map((account) => account.name), ['Tiền mặt']);
  });

  it('gives starters saved before keys existed their key, leaving renamed ones custom', async () => {
    // The fixture's Food predates keys.
    await seedFixture();
    await guestStore.mutate((data) => ({
      ...data,
      starterCategoriesVersion: 1,
      categories: [...data.categories, { ...data.categories[0]!, id: 'scratch-renamed', name: 'Groceries!' }],
    }));

    await ensureSeeded();

    const categories = guestStore.current().categories;
    assert.equal(categories.find((category) => category.id === EXPENSE_CATEGORY_ID)?.systemKey, 'food');
    assert.equal(categories.find((category) => category.id === 'scratch-renamed')?.systemKey ?? null, null);
  });
});
