import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { rememberInvitation, takeRememberedInvitation } from './rememberedInvitation.ts';

describe('remembered invitation', () => {
  it('hands the token over once, then nothing', () => {
    rememberInvitation('token-a');
    assert.equal(takeRememberedInvitation(), 'token-a');
    assert.equal(takeRememberedInvitation(), null);
  });

  it('keeps only the latest link opened', () => {
    rememberInvitation('token-a');
    rememberInvitation('token-b');
    assert.equal(takeRememberedInvitation(), 'token-b');
  });
});
