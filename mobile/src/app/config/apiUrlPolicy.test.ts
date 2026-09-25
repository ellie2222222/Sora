import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { assertSecureApiUrl } from './apiUrlPolicy.ts';

describe('assertSecureApiUrl', () => {
  it('refuses http in a release build', () => {
    assert.throws(() => assertSecureApiUrl('http://192.168.1.5:3000', false, false), /https/);
  });

  it('accepts https in a release build', () => {
    assert.equal(assertSecureApiUrl('https://api.example.invalid', false, false), 'https://api.example.invalid');
  });

  it('accepts http in development or with the explicit opt-in', () => {
    assert.equal(assertSecureApiUrl('http://localhost:3000', true, false), 'http://localhost:3000');
    assert.equal(assertSecureApiUrl('http://192.168.1.5:3000', false, true), 'http://192.168.1.5:3000');
  });
});
