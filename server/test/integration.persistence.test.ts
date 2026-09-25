import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, describe, it } from 'node:test';

import { AuditService } from '../src/audit/audit.service.ts';
import { DatabaseService } from '../src/database/database.service.ts';
import { createAccount, integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

const blockedFetch = globalThis.fetch;

function stubRates(vndPerUsd: number | null): { calls: () => number } {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (vndPerUsd === null) throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ result: 'success', base_code: 'USD', time_last_update_utc: new Date().toUTCString(), rates: { USD: 1, VND: vndPerUsd } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { calls: () => calls };
}

describe('persistence paths against a real database', { skip: integrationSkipReason() }, () => {
  afterEach(() => {
    globalThis.fetch = blockedFetch;
  });

  describe('exchange-rate snapshots', () => {
    let user: ProbeUser;
    let today = '';

    async function valuation(api: TestApi) {
      const response = await api.call('GET', `/dashboard?walletId=${user.walletId}&displayCurrency=USD`, { token: user.token });
      assert.equal(response.status, 200);
      return response.body!.data.valuation as { amount: string | null; status: string };
    }

    async function snapshots(api: TestApi) {
      return api.sql<{ rates: Record<string, number> }>(
        "SELECT rates FROM exchange_rate_snapshots WHERE base_currency = 'USD' AND snapshot_date = $1",
        [today],
      );
    }

    // Each phase boots its own app, so the in-process cache can't answer and the database must.
    async function withFreshApp<T>(run: (api: TestApi) => Promise<T>): Promise<T> {
      const api = await startTestApi();
      try {
        return await run(api);
      } finally {
        await api.close();
      }
    }

    before(async () => {
      await withFreshApp(async (api) => {
        user = await registerProbeUser(api, 'fx');
        await createAccount(api, user, user.walletId, { initialBalance: '1000000' });
        today = (await api.sql<{ day: string }>("SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day"))[0]!.day;
        await api.sql("DELETE FROM exchange_rate_snapshots WHERE base_currency = 'USD' AND snapshot_date = $1", [today]);
      });
    });

    it('saves a snapshot on a fresh fetch, updates the same day\'s row in place, and falls back to it when the provider is down', async () => {
      const first = stubRates(25000);
      const fresh = await withFreshApp(async (api) => {
        const result = await valuation(api);
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { result, rows: await snapshots(api) };
      });
      assert.equal(first.calls(), 1);
      assert.deepEqual([fresh.result.amount, fresh.result.status], ['40.0000', 'FRESH']);
      assert.deepEqual(fresh.rows.map((row) => row.rates.VND), [25000]);

      stubRates(20000);
      const updated = await withFreshApp(async (api) => {
        const result = await valuation(api);
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { result, rows: await snapshots(api) };
      });
      assert.deepEqual([updated.result.amount, updated.result.status], ['50.0000', 'FRESH']);
      assert.deepEqual(updated.rows.map((row) => row.rates.VND), [20000], 'one row per day and base, updated rather than duplicated');

      stubRates(null);
      const stale = await withFreshApp((api) => valuation(api));
      assert.deepEqual([stale.amount, stale.status], ['50.0000', 'STALE'], 'the last saved rates, marked as such');
    });

    it('reports the valuation as unavailable when neither the provider nor a snapshot can answer', async () => {
      stubRates(null);
      await withFreshApp(async (api) => {
        const other = await registerProbeUser(api, 'fx-none');
        await createAccount(api, other, other.walletId, { initialBalance: '5', currency: 'EUR' });
        const response = await api.call('GET', `/dashboard?walletId=${other.walletId}&displayCurrency=JPY`, { token: other.token });
        assert.equal(response.status, 200, 'the dashboard itself never fails on a rate outage');
        assert.equal(response.body!.data.valuation.status, 'UNAVAILABLE');
        assert.equal(response.body!.data.valuation.amount, null);
      });
    });
  });

  describe('the audit savepoint (rule 16)', () => {
    let api: TestApi;

    before(async () => {
      api = await startTestApi();
    });

    after(async () => {
      await api?.close();
    });

    it('keeps the caller\'s write when its audit insert fails inside the same transaction', async () => {
      const user = await registerProbeUser(api, 'savepoint');
      const database = api.app.get(DatabaseService);
      const audit = api.app.get(AuditService);
      const marker = `probe-savepoint-${randomUUID()}`.slice(0, 60);

      await database.db.transaction().execute(async (trx) => {
        await trx.updateTable('users').set({ display_name: marker }).where('id', '=', user.id).execute();
        // entity_id is VARCHAR(64); 65 characters makes the audit insert itself fail.
        await audit.record({ event: 'USER_REGISTERED', entityType: 'USER', entityId: 'x'.repeat(65), actorId: user.id }, trx);
      });

      const [row] = await api.sql<{ display_name: string }>('SELECT display_name FROM users WHERE id = $1', [user.id]);
      assert.equal(row?.display_name, marker, 'the failed audit row must not turn the commit into a rollback');
    });
  });
});
