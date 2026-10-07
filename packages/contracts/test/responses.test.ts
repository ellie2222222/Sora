import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ERROR_CODES, ERROR_STATUS, type ErrorCode } from '../src/responses.ts';

function codesWithStatus(status: number): ErrorCode[] {
  return ERROR_CODES.filter((code) => ERROR_STATUS[code] === status).sort();
}

describe('ERROR_STATUS', () => {
  it('pins the statuses the API specification §2.6 gives a specific meaning', () => {
    const pinned: Partial<Record<ErrorCode, number>> = {
      VALIDATION_FAILED: 422,
      FORBIDDEN: 403,
      INVITATION_EXPIRED: 410,
      BUDGET_PERIOD_OVERLAP: 409,
      CATEGORY_DUPLICATE_NAME: 409,
      EMAIL_ALREADY_REGISTERED: 409,
      RATE_LIMITED: 429,
      ROUTE_NOT_FOUND: 404,
      INTERNAL_ERROR: 500,
    };
    for (const [code, status] of Object.entries(pinned)) {
      assert.equal(ERROR_STATUS[code as ErrorCode], status, code);
    }
  });

  it('maps every *_NOT_FOUND code to 404, which AC-01 uses to hide a non-member resource', () => {
    const notFound = ERROR_CODES.filter((code) => code.endsWith('_NOT_FOUND'));
    assert.ok(notFound.length > 0);
    for (const code of notFound) {
      assert.equal(ERROR_STATUS[code], 404, code);
    }
  });

  it('answers 401 only for missing or bad credentials, which the app treats as "refresh or sign in again"', () => {
    assert.deepEqual(codesWithStatus(401), [
      'CREDENTIALS_INVALID',
      'GOOGLE_TOKEN_INVALID',
      'TOKEN_EXPIRED',
      'TOKEN_INVALID',
      'UNAUTHENTICATED',
    ]);
  });

  it('keeps the set of 403 codes fixed, so a new one forces an AC-01 review', () => {
    // A 403 confirms the target exists (AC-01), so adding a code here needs a reason it cannot leak.
    assert.deepEqual(codesWithStatus(403), [
      'CATEGORY_WRONG_WALLET',
      'FORBIDDEN',
      'INVITATION_EMAIL_MISMATCH',
    ]);
  });

  it('reserves 410 for an expired invitation alone', () => {
    assert.deepEqual(codesWithStatus(410), ['INVITATION_EXPIRED']);
  });

  it('has a status for every code and no status for a code that does not exist', () => {
    assert.deepEqual(Object.keys(ERROR_STATUS).sort(), [...ERROR_CODES].sort());
  });
});
