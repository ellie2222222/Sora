import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { registerSchema } from '../src/schemas.ts';

const registration = (password: string) => ({ email: 'probe@example.invalid', password, displayName: 'probe', timeZone: 'Asia/Ho_Chi_Minh' });

describe('registerSchema password length (spec §5.1: 12–200 characters)', () => {
  it('AUTH-US-01: accepts exactly 12 and exactly 200 characters', () => {
    assert.equal(registerSchema.safeParse(registration('p'.repeat(12))).success, true);
    assert.equal(registerSchema.safeParse(registration('p'.repeat(200))).success, true);
  });

  it('AUTH-US-01: rejects 201 characters on the password field', () => {
    const result = registerSchema.safeParse(registration('p'.repeat(201)));
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues.map((issue) => issue.path.join('.')), ['password']);
  });
});
