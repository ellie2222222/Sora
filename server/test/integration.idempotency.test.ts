import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { API_PREFIX } from '@sora/contracts';

import {
  categoryOf,
  createAccount,
  integrationSkipReason,
  registerProbeUser,
  startTestApi,
  type ProbeUser,
  type TestApi,
} from './support/integration.ts';

const WHEN = '2026-06-10T09:00:00.000Z';

/** The interceptor's own fingerprint of a create, for staging a claim as another attempt would have left it. */
function fingerprintOf(body: Record<string, unknown>): string {
  return createHash('sha256').update(`POST ${API_PREFIX}/transactions ${JSON.stringify(body)}`).digest('hex');
}

/** API spec §2.10 against a real database: claims, replays, waits and take-overs held in idempotency_keys. */
describe('idempotency keys against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;
  let user: ProbeUser;
  let account: string;
  let food: string;

  const expense = (description: string, amount = '7') => ({
    type: 'EXPENSE',
    fromAccountId: account,
    categoryId: food,
    amount,
    currency: 'VND',
    transactionDate: WHEN,
    description,
  });
  const send = (target: TestApi, key: string, body: Record<string, unknown>, token = user.token) =>
    target.call('POST', '/transactions', { token, headers: { 'Idempotency-Key': key }, body });
  const rowsDescribed = async (description: string) =>
    (await api.sql('SELECT id FROM transactions WHERE description = $1', [description])).length;

  before(async () => {
    api = await startTestApi();
    user = await registerProbeUser(api, 'idem');
    account = await createAccount(api, user, user.walletId, { initialBalance: '1000' });
    food = await categoryOf(api, user, user.walletId, 'EXPENSE');
  });

  after(async () => {
    await api?.close();
  });

  it('replays a completed create after an API restart, recording it once', async () => {
    const key = `probe-${randomUUID()}`;
    const description = `probe-restart-${randomUUID()}`;
    const first = await send(api, key, expense(description));

    const restarted = await startTestApi();
    try {
      const retry = await send(restarted, key, expense(description));
      assert.deepEqual([first.status, retry.status], [201, 201]);
      assert.equal(retry.body!.data.id, first.body!.data.id, 'the retry gets the original response');
    } finally {
      await restarted.close();
    }
    assert.equal(await rowsDescribed(description), 1);
  });

  it('refuses the same key on a different body with 422, recording nothing for it', async () => {
    const key = `probe-${randomUUID()}`;
    const description = `probe-mismatch-${randomUUID()}`;
    assert.equal((await send(api, key, expense(description))).status, 201);
    const different = await send(api, key, expense(description, '8'));
    assert.deepEqual([different.status, different.body?.error?.code], [422, 'VALIDATION_FAILED']);
    assert.equal(await rowsDescribed(description), 1);
  });

  it('forgets a failed attempt, so its retry runs again instead of replaying the error', async () => {
    const key = `probe-${randomUUID()}`;
    const failed = await send(api, key, { ...expense(`probe-failed-${randomUUID()}`), currency: 'USD' });
    assert.deepEqual([failed.status, failed.body?.error?.code], [422, 'ACCOUNT_CURRENCY_MISMATCH']);
    assert.deepEqual(await api.sql('SELECT id FROM idempotency_keys WHERE idempotency_key = $1', [key]), []);
  });

  it('makes a retry wait for the first attempt still running, then answers with its response', async () => {
    const key = `probe-${randomUUID()}`;
    const body = expense(`probe-wait-${randomUUID()}`);
    // Another process's attempt, mid-flight: claimed, not yet completed.
    await api.sql('INSERT INTO idempotency_keys (user_id, idempotency_key, fingerprint) VALUES ($1, $2, $3)', [user.id, key, fingerprintOf(body)]);

    const retry = send(api, key, body);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await api.sql(
      `UPDATE idempotency_keys SET response = '{"id":"from-first-attempt"}'::jsonb, completed_at = now() WHERE user_id = $1 AND idempotency_key = $2`,
      [user.id, key],
    );

    const answered = await retry;
    assert.deepEqual([answered.status, answered.body?.data?.id], [201, 'from-first-attempt']);
    assert.equal(await rowsDescribed(body.description), 0, 'the retry never ran a second write');
  });

  it('takes over a claim whose attempt died before completing, and records the write once', async () => {
    const key = `probe-${randomUUID()}`;
    const body = expense(`probe-abandoned-${randomUUID()}`);
    await api.sql(
      `INSERT INTO idempotency_keys (user_id, idempotency_key, fingerprint, claimed_at, created_at)
       VALUES ($1, $2, $3, now() - interval '10 minutes', now() - interval '10 minutes')`,
      [user.id, key, fingerprintOf(body)],
    );

    const retry = await send(api, key, body);
    assert.equal(retry.status, 201, JSON.stringify(retry.body));
    assert.equal(await rowsDescribed(body.description), 1);
    const [claim] = await api.sql<{ completed: boolean }>(
      'SELECT completed_at IS NOT NULL AS completed FROM idempotency_keys WHERE user_id = $1 AND idempotency_key = $2',
      [user.id, key],
    );
    assert.equal(claim!.completed, true);
  });

  it('scopes a key to its user, and refuses one longer than 255 characters', async () => {
    const other = await registerProbeUser(api, 'idem-other');
    const otherAccount = await createAccount(api, other, other.walletId, { initialBalance: '1000' });
    const otherFood = await categoryOf(api, other, other.walletId, 'EXPENSE');
    const key = `probe-${randomUUID()}`;
    const mine = await send(api, key, expense(`probe-scope-${randomUUID()}`));
    const theirs = await send(api, key, { ...expense(`probe-scope-${randomUUID()}`), fromAccountId: otherAccount, categoryId: otherFood }, other.token);
    assert.deepEqual([mine.status, theirs.status], [201, 201]);
    assert.notEqual(mine.body!.data.id, theirs.body!.data.id);

    const long = await send(api, 'k'.repeat(256), expense(`probe-long-${randomUUID()}`));
    assert.deepEqual([long.status, long.body?.error?.code], [422, 'VALIDATION_FAILED']);
  });
});
