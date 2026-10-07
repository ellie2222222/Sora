import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { STARTER_CATEGORIES } from '@sora/contracts';

import { ensureSeeded, STARTER_CATEGORIES_VERSION } from './guestSeed.ts';
import { guestStore } from './guestStorage.ts';
import { seedFixture, withFreshStore } from './testSupport.ts';

const STARTER_NAMES = STARTER_CATEGORIES.map((category) => category.names.en).sort();

function categoryNames(): string[] {
  return guestStore
    .current()
    .categories.map((category) => category.name)
    .sort();
}

async function addRootCategory(name: string): Promise<void> {
  await guestStore.mutate((data) => ({
    ...data,
    categories: [...data.categories, { ...data.categories[0]!, id: `scratch-${name}`, name }],
  }));
}

beforeEach(async () => {
  await withFreshStore();
});

describe('ensureSeeded', () => {
  it('seeds a fresh guest wallet with every starter category, already at the current version', async () => {
    await ensureSeeded();
    assert.deepEqual(categoryNames(), STARTER_NAMES);
    assert.equal(guestStore.current().starterCategoriesVersion, STARTER_CATEGORIES_VERSION);
  });

  it('backfills the starters a wallet seeded on an older list is missing, keeping its own', async () => {
    // The fixture's Food and Salary share starter names, so they are kept rather than duplicated.
    await seedFixture();

    await ensureSeeded();

    assert.deepEqual(categoryNames(), STARTER_NAMES);
    assert.equal(guestStore.current().starterCategoriesVersion, STARTER_CATEGORIES_VERSION);
  });

  it('runs once per version, so a starter deleted after the backfill stays deleted', async () => {
    await seedFixture();
    await ensureSeeded();
    await guestStore.mutate((data) => ({
      ...data,
      categories: data.categories.filter((category) => category.name !== 'Pets'),
    }));

    await ensureSeeded();

    assert.equal(categoryNames().includes('Pets'), false);
  });

  it('skips a starter name the wallet already uses at the root, whatever its case or type', async () => {
    await seedFixture();
    await addRootCategory('savings');

    await ensureSeeded();

    assert.equal(categoryNames().filter((name) => name.toLowerCase() === 'savings').length, 1);
  });

  it('does not add "Other Expense" beside the old starter "Other"', async () => {
    await seedFixture();
    await addRootCategory('Other');

    await ensureSeeded();

    assert.equal(categoryNames().includes('Other Expense'), false);
  });
});
