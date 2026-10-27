import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { CARD_NETWORKS, type AccountResponse } from '@sora/contracts';

import { CARD_NETWORK_NAME, cardDetailsOf, maskedCardDigits } from './cardNetworks.ts';

describe('cardNetworks', () => {
  it('names every network but OTHER, which is translated', () => {
    assert.deepEqual(Object.keys(CARD_NETWORK_NAME).sort(), CARD_NETWORKS.filter((network) => network !== 'OTHER').sort());
  });

  it('shows only the four digits, behind a mask', () => {
    assert.equal(maskedCardDigits('4821'), '•••• 4821');
  });
});

describe('cardDetailsOf', () => {
  it('reads card details a server or saved copy left out as none, never undefined', () => {
    const legacy = { id: 'a', type: 'BANK_ACCOUNT' } as unknown as AccountResponse;
    assert.deepEqual(cardDetailsOf(legacy), { institutionName: null, cardNetwork: null, cardLast4: null });
  });
});
