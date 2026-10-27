import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { cardBalanceOf, openingBalanceFor } from './accountBalance.ts';

describe('openingBalanceFor', () => {
  it('stores what a credit card owes as the negative balance it is', () => {
    assert.equal(openingBalanceFor('CREDIT_CARD', '3000000'), '-3000000.0000');
  });

  it('keeps every other opening balance as entered', () => {
    assert.equal(openingBalanceFor('BANK_ACCOUNT', '10000000'), '10000000');
  });
});

describe('cardBalanceOf', () => {
  it('shows a credit card in debt as an unsigned amount owed', () => {
    assert.deepEqual(cardBalanceOf({ type: 'CREDIT_CARD', balance: '-3000000.0000' }), { amount: '3000000.0000', owed: true });
  });

  it('shows an overpaid card, and any other account, as its balance', () => {
    assert.deepEqual(cardBalanceOf({ type: 'CREDIT_CARD', balance: '50000.0000' }), { amount: '50000.0000', owed: false });
    assert.deepEqual(cardBalanceOf({ type: 'CASH', balance: '-134000.0000' }), { amount: '-134000.0000', owed: false });
  });
});
