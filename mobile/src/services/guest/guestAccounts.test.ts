import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { guestAccountsApi } from './guestAccounts.ts';
import { guestGoalsApi } from './guestGoals.ts';
import { guestTransactionsApi } from './guestTransactions.ts';
import { ACCOUNT_ID, codeOf, EXPENSE_CATEGORY_ID, OTHER_ACCOUNT_ID, seedFixture, WALLET_ID, withFreshStore } from './testSupport.ts';

const DATE = '2026-09-05T10:00:00.000Z';

beforeEach(async () => {
  await withFreshStore();
  await seedFixture();
});

describe('guestAccountsApi.update — ACC-US-04', () => {
  it('changes currency only while no transaction or contribution names the account (API spec §9.4)', async () => {
    const empty = await guestAccountsApi.create({ walletId: WALLET_ID, name: 'Fresh', type: 'CASH', currency: 'VND', initialBalance: '0' });
    assert.equal((await guestAccountsApi.update(empty.id, { currency: 'USD' })).currency, 'USD');

    await guestTransactionsApi.create({
      type: 'EXPENSE',
      fromAccountId: ACCOUNT_ID,
      categoryId: EXPENSE_CATEGORY_ID,
      amount: '1',
      currency: 'VND',
      transactionDate: DATE,
    });
    const goal = await guestGoalsApi.create({ walletId: WALLET_ID, name: 'Trip', targetAmount: '100', currency: 'VND' });
    await guestGoalsApi.addContribution(goal.id, { accountId: OTHER_ACCOUNT_ID, amount: '5', currency: 'VND', contributionDate: DATE, recordAsTransaction: false });

    for (const accountId of [ACCOUNT_ID, OTHER_ACCOUNT_ID]) {
      assert.equal(await codeOf(() => guestAccountsApi.update(accountId, { currency: 'USD' })), 'ACCOUNT_CURRENCY_MISMATCH');
    }
  });
});

describe('guestAccountsApi card details — ACC-US-01/04', () => {
  it('keeps a card\'s bank, network and last four, as the API does', async () => {
    const card = await guestAccountsApi.create({
      walletId: WALLET_ID, name: 'My Visa', type: 'CREDIT_CARD', currency: 'VND', initialBalance: '0',
      institutionName: 'Vietcombank', cardNetwork: 'VISA', cardLast4: '4821',
    });
    assert.deepEqual([card.institutionName, card.cardNetwork, card.cardLast4], ['Vietcombank', 'VISA', '4821']);
    const cleared = await guestAccountsApi.update(card.id, { cardNetwork: null });
    assert.deepEqual([cleared.institutionName, cleared.cardNetwork, cleared.cardLast4], ['Vietcombank', null, '4821']);
  });

  it('refuses a card detail the stored type may not hold, on create and on update', async () => {
    const created = await codeOf(() =>
      guestAccountsApi.create({ walletId: WALLET_ID, name: 'Pocket', type: 'CASH', currency: 'VND', initialBalance: '0', institutionName: 'Vietcombank' }),
    );
    assert.equal(created, 'VALIDATION_FAILED');
    const wallet = await guestAccountsApi.create({ walletId: WALLET_ID, name: 'MoMo', type: 'E_WALLET', currency: 'VND', initialBalance: '0' });
    assert.equal(await codeOf(() => guestAccountsApi.update(wallet.id, { cardLast4: '1234' })), 'VALIDATION_FAILED');
    assert.equal((await guestAccountsApi.update(wallet.id, { institutionName: 'MoMo' })).institutionName, 'MoMo');
  });

  it('reads an account saved before card details existed as having none', async () => {
    const [saved] = await guestAccountsApi.list();
    assert.deepEqual([saved?.institutionName, saved?.cardNetwork, saved?.cardLast4], [null, null, null]);
  });
});
