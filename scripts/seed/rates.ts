// Phase 8: the dashboard's converted total against rates-stub.mts — FRESH from the stub, then STALE
// once the stub fails and the API's cache TTL has passed (it falls back to the rates it last had).

import { formatMoney, type DashboardResponse } from '@sora/contracts';

import type { SeedApi } from './client.ts';
import { walletBalances } from './figures.ts';
import type { Ledger } from './ledger.ts';
import type { Seeder } from './post.ts';

/**
 * VND per one unit of each currency. Each reciprocal × 10^8 is a whole number, so the server's
 * conversion (amount × 10^8 / round(rate × 10^8)) is exact and the expected total can be too.
 */
export const VND_PER_UNIT: Record<string, number> = { VND: 1, USD: 25_000, JPY: 160, AUD: 16_000 };

export function expectedVndValuation(ledger: Ledger): string {
  let total = 0n;
  for (const [currency, amount] of walletBalances(ledger, 'an')) total += amount * BigInt(VND_PER_UNIT[currency]!);
  return formatMoney(total);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function checkRates(api: SeedApi, seeder: Seeder, ledger: Ledger, ratesUrl: string): Promise<void> {
  const session = seeder.session('an');
  const read = () => api.call<DashboardResponse>('GET', `/dashboard?walletId=${seeder.ids.wallets.an}&displayCurrency=VND`, { session });
  const expected = expectedVndValuation(ledger);

  const fresh = (await read()).valuation;
  if (fresh?.status !== 'FRESH' || fresh.amount !== expected) throw new Error(`Expected a FRESH ${expected} VND, got ${JSON.stringify(fresh)}`);
  console.log(`  FRESH: ${fresh.amount} VND, from the stub's rates`);

  await fetch(`${ratesUrl}/_control/down`, { method: 'POST' });
  try {
    const deadline = Date.now() + 5 * 60_000;
    for (;;) {
      const valuation = (await read()).valuation;
      if (valuation?.status === 'STALE') {
        if (valuation.amount !== expected) throw new Error(`STALE valuation ${valuation.amount}, expected ${expected}`);
        console.log(`  STALE: ${valuation.amount} VND, from the last rates the API had`);
        return;
      }
      if (Date.now() > deadline) throw new Error('Still not STALE after 5 minutes; is EXCHANGE_RATE_CACHE_TTL_MINUTES=1 set on the API?');
      await sleep(10_000);
    }
  } finally {
    await fetch(`${ratesUrl}/_control/up`, { method: 'POST' });
  }
}
