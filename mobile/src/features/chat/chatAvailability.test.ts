import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { chatAvailability } from './chatAvailability.ts';

describe('chatAvailability — AI-US-01', () => {
  it('turns sending off while offline, and says so before any role reason', () => {
    assert.deepEqual(chatAvailability({ isOnline: false, isSending: false, canWrite: false }), { canSend: false, blockedReason: 'offline' });
  });

  it('lets a VIEWER send but blocks confirming proposals as view-only', () => {
    assert.deepEqual(chatAvailability({ isOnline: true, isSending: false, canWrite: false }), { canSend: true, blockedReason: 'viewOnly' });
  });

  it('holds a second send while one is in flight', () => {
    assert.deepEqual(chatAvailability({ isOnline: true, isSending: true, canWrite: true }), { canSend: false, blockedReason: null });
  });
});
