import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { AppError } from '../src/common/app-error.ts';
import { rethrowPgError, translatingPgErrors } from '../src/common/pg-error.ts';

/** The shape node-postgres gives a constraint violation: SQLSTATE plus the constraint's name. */
function violation(code: string, constraint: string): Error & { code: string; constraint: string } {
  return Object.assign(new Error(`violates "${constraint}"`), { code, constraint });
}

function translated(error: unknown): unknown {
  try {
    rethrowPgError(error);
  } catch (thrown) {
    return thrown;
  }
  assert.fail('rethrowPgError returned instead of throwing');
}

describe('rethrowPgError', () => {
  for (const constraint of ['excl_budget_category_overlap', 'excl_budget_goal_overlap', 'excl_budget_overall_overlap']) {
    it(`BUD-US-01: maps ${constraint} to BUDGET_PERIOD_OVERLAP rather than a 500`, () => {
      const thrown = translated(violation('23P01', constraint));
      assert.ok(thrown instanceof AppError);
      assert.equal(thrown.code, 'BUDGET_PERIOD_OVERLAP');
    });
  }

  it('maps a unique violation on the single-owner index to WALLET_LAST_OWNER', () => {
    const thrown = translated(violation('23505', 'uq_wallet_single_owner'));
    assert.ok(thrown instanceof AppError);
    assert.equal(thrown.code, 'WALLET_LAST_OWNER');
  });

  it('rethrows an unmapped constraint untouched, so a missing mapping is not disguised as a 409', () => {
    const original = violation('23P01', 'excl_not_a_real_constraint');
    assert.equal(translated(original), original);
  });

  it('rethrows an error that is not a constraint violation untouched', () => {
    const original = violation('40001', 'excl_budget_category_overlap');
    assert.equal(translated(original), original);
  });

  it('lets a per-call override replace the default code', async () => {
    await assert.rejects(
      translatingPgErrors(async () => {
        throw violation('23505', 'uq_wallet_member');
      }, { uq_wallet_member: 'INVITATION_ALREADY_USED' }),
      (error: unknown) => error instanceof AppError && error.code === 'INVITATION_ALREADY_USED',
    );
  });
});
