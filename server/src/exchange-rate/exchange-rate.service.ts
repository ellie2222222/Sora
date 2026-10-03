import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  ZERO,
  add,
  formatMoney,
  parseMoney,
  ValuationStatus,
  type ConvertedValuation,
  type CurrencyTotal,
  type Scaled,
} from '@sora/contracts';

import { CONFIG, type AppConfig } from '../config/env.ts';
import { DatabaseService } from '../database/database.service.ts';

interface CacheEntry {
  rates: Record<string, number>;
  timestamp: string;
  expiresAt: number;
}

interface OpenErApiResponse {
  result: string;
  provider?: string;
  documentation?: string;
  terms_of_use?: string;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  time_next_update_unix?: number;
  time_next_update_utc?: string;
  base_code?: string;
  rates?: Record<string, number>;
}

export interface RateLookupResult {
  rates: Record<string, number>;
  timestamp: string;
  status: typeof ValuationStatus.FRESH | typeof ValuationStatus.STALE;
}

export interface RateLookupOptions {
  allowStale?: boolean;
  historicalDate?: string;
}

const RATE_PRECISION_SCALE = 100_000_000n; // 10^8
const RATE_PRECISION_FLOAT = 100_000_000;
const FAILURE_COOLDOWN_MS = 60_000;

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<CacheEntry | null>>();
  private readonly failedUntil = new Map<string, number>();

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Optional() private readonly databaseService?: DatabaseService,
  ) {}

  /**
   * Fetch exchange rates for a base currency.
   *
   * Rate States:
   * 1. FRESH: returned from cache within TTL or newly retrieved from external provider.
   * 2. STALE: external provider cannot be reached, but an expired cache or prior daily snapshot exists.
   * 3. UNAVAILABLE: no rate can be retrieved (returns null).
   */
  async getRates(
    baseCurrency: string,
    options?: RateLookupOptions,
  ): Promise<RateLookupResult | null> {
    const historicalDate = options?.historicalDate;
    if (historicalDate !== undefined) {
      return this.getHistoricalRates(baseCurrency, historicalDate);
    }

    const cached = this.cache.get(baseCurrency);
    if (cached && cached.expiresAt > Date.now()) {
      return { rates: cached.rates, timestamp: cached.timestamp, status: ValuationStatus.FRESH };
    }

    const fetched = await this.fetchLatest(baseCurrency);
    if (fetched) return { rates: fetched.rates, timestamp: fetched.timestamp, status: ValuationStatus.FRESH };
    return this.getStaleFallback(baseCurrency, options?.allowStale);
  }

  /**
   * One provider request per base currency at a time, shared by every concurrent caller. After a
   * failure the provider is skipped for a cooldown, so an outage doesn't cost each request the timeout.
   */
  private fetchLatest(baseCurrency: string): Promise<CacheEntry | null> {
    if ((this.failedUntil.get(baseCurrency) ?? 0) > Date.now()) return Promise.resolve(null);

    let pending = this.inFlight.get(baseCurrency);
    if (!pending) {
      pending = this.requestLatest(baseCurrency).finally(() => this.inFlight.delete(baseCurrency));
      this.inFlight.set(baseCurrency, pending);
    }
    return pending;
  }

  private async requestLatest(baseCurrency: string): Promise<CacheEntry | null> {
    const apiUrl = `${this.config.EXCHANGE_RATE_API_URL.replace(/\/+$/, '')}/${encodeURIComponent(baseCurrency)}`;
    const timeoutMs = this.config.EXCHANGE_RATE_TIMEOUT_SECONDS * 1000;

    try {
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn(`Exchange rate provider returned status ${response.status} for base ${baseCurrency}`);
        return this.markFailed(baseCurrency);
      }

      const data = (await response.json()) as OpenErApiResponse;
      if (data.result !== 'success' || !data.rates || typeof data.rates !== 'object') {
        this.logger.warn(`Exchange rate provider returned invalid response structure for base ${baseCurrency}`);
        return this.markFailed(baseCurrency);
      }

      const timestamp = data.time_last_update_utc ?? new Date().toISOString();
      const ttlMs = this.config.EXCHANGE_RATE_CACHE_TTL_MINUTES * 60 * 1000;
      const entry: CacheEntry = {
        rates: data.rates,
        timestamp,
        expiresAt: Date.now() + ttlMs,
      };

      this.cache.set(baseCurrency, entry);
      this.failedUntil.delete(baseCurrency);

      // Persist daily snapshot asynchronously in the background (idempotent upsert)
      const snapshotDate = this.deriveSnapshotDate(timestamp);
      void this.saveDailySnapshot(snapshotDate, baseCurrency, data.rates, timestamp);

      return entry;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to fetch exchange rates for ${baseCurrency}: ${message}`);
      return this.markFailed(baseCurrency);
    }
  }

  private markFailed(baseCurrency: string): null {
    this.failedUntil.set(baseCurrency, Date.now() + FAILURE_COOLDOWN_MS);
    return null;
  }

  /**
   * Stale rate fallback: if provider fails, check expired in-memory cache or latest daily snapshot.
   */
  private async getStaleFallback(
    baseCurrency: string,
    allowStale: boolean = true,
  ): Promise<RateLookupResult | null> {
    if (!allowStale) return null;

    // Check in-memory cache first (even if expired)
    const cached = this.cache.get(baseCurrency);
    if (cached) {
      this.logger.log(`Using expired in-memory cache for ${baseCurrency} as stale fallback`);
      return { rates: cached.rates, timestamp: cached.timestamp, status: ValuationStatus.STALE };
    }

    if (this.databaseService) {
      try {
        const snapshot = await this.databaseService.db
          .selectFrom('exchange_rate_snapshots')
          .selectAll()
          .where('base_currency', '=', baseCurrency)
          .orderBy('snapshot_date', 'desc')
          .limit(1)
          .executeTakeFirst();

        if (snapshot) {
          const rates = typeof snapshot.rates === 'string' ? JSON.parse(snapshot.rates) : snapshot.rates;
          const timestamp = new Date(snapshot.fetched_at).toISOString();
          this.logger.log(`Using database snapshot from ${snapshot.snapshot_date} for ${baseCurrency} as stale fallback`);
          return { rates, timestamp, status: ValuationStatus.STALE };
        }
      } catch (dbErr) {
        this.logger.warn(`Error querying stale exchange rate snapshot for ${baseCurrency}: ${(dbErr as Error).message}`);
      }
    }

    return null;
  }

  /**
   * Retrieves historical rates for a specific calendar date from daily snapshots.
   * If not available, returns null (never guesses or substitutes today's rate).
   */
  private async getHistoricalRates(
    baseCurrency: string,
    date: string,
  ): Promise<RateLookupResult | null> {
    if (!this.databaseService) return null;

    try {
      const snapshot = await this.databaseService.db
        .selectFrom('exchange_rate_snapshots')
        .selectAll()
        .where('base_currency', '=', baseCurrency)
        .where('snapshot_date', '=', date)
        .executeTakeFirst();

      if (!snapshot) {
        this.logger.log(`No exchange rate snapshot found for ${baseCurrency} on historical date ${date}`);
        return null;
      }

      const rates = typeof snapshot.rates === 'string' ? JSON.parse(snapshot.rates) : snapshot.rates;
      const timestamp = new Date(snapshot.fetched_at).toISOString();
      return { rates, timestamp, status: ValuationStatus.FRESH };
    } catch (err) {
      this.logger.warn(`Failed to fetch historical exchange rate snapshot: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Idempotent daily snapshot persistence.
   */
  private async saveDailySnapshot(
    snapshotDate: string,
    baseCurrency: string,
    rates: Record<string, number>,
    fetchedAtIso: string,
  ): Promise<void> {
    if (!this.databaseService) return;

    try {
      await this.databaseService.db
        .insertInto('exchange_rate_snapshots')
        .values({
          snapshot_date: snapshotDate,
          base_currency: baseCurrency,
          rates: rates as any,
          source: 'open.er-api.com',
          fetched_at: new Date(fetchedAtIso),
        })
        .onConflict((oc) =>
          oc.columns(['snapshot_date', 'base_currency']).doUpdateSet({
            rates: rates as any,
            fetched_at: new Date(fetchedAtIso),
          }),
        )
        .execute();
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to persist daily exchange rate snapshot for ${baseCurrency} on ${snapshotDate}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Calculates a single valuation amount for a list of CurrencyTotals in targetCurrency.
   *
   * Core financial & valuation rules:
   * 1. Native financial data is NEVER mutated or rounded.
   * 2. Complete conversion rule: every currency with non-zero balance contributing to the total
   *    must have a valid conversion path. If any currency is missing or cannot be converted,
   *    the overall total is UNAVAILABLE, amount is null, and missingCurrencies is returned.
   * 3. Stale transparency: if a stale rate was used as fallback, valuation.status is STALE.
   */
  async calculateValuation(
    totals: CurrencyTotal[],
    targetCurrency: string,
    options?: RateLookupOptions,
  ): Promise<ConvertedValuation> {
    if (totals.length === 0) {
      return {
        currency: targetCurrency,
        amount: '0.0000',
        isApproximate: false,
        status: ValuationStatus.FRESH,
      };
    }

    const isAllTargetCurrency = totals.every((t) => t.currency === targetCurrency);
    if (isAllTargetCurrency) {
      let sum: Scaled = ZERO;
      for (const t of totals) {
        sum = add(sum, parseMoney(t.amount));
      }
      return {
        currency: targetCurrency,
        amount: formatMoney(sum),
        isApproximate: false,
        status: ValuationStatus.FRESH,
      };
    }

    const contributingForeignCurrencies = Array.from(
      new Set(
        totals
          .filter((t) => t.currency !== targetCurrency && parseMoney(t.amount) !== ZERO)
          .map((t) => t.currency),
      ),
    );

    const rateResult = await this.getRates(targetCurrency, options);
    if (!rateResult) {
      return {
        currency: targetCurrency,
        amount: null,
        isApproximate: true,
        status: ValuationStatus.UNAVAILABLE,
        missingCurrencies: contributingForeignCurrencies,
      };
    }

    const { rates, timestamp, status: rateStatus } = rateResult;
    const missingCurrencies: string[] = [];

    for (const curr of contributingForeignCurrencies) {
      const rate = rates[curr];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        missingCurrencies.push(curr);
      }
    }

    // If ANY contributing currency rate is missing, do not calculate a partial/fake sum!
    if (missingCurrencies.length > 0) {
      this.logger.warn(
        `Missing conversion rates for [${missingCurrencies.join(', ')}] against target ${targetCurrency}. Valuation unavailable.`,
      );
      return {
        currency: targetCurrency,
        amount: null,
        isApproximate: true,
        status: ValuationStatus.UNAVAILABLE,
        missingCurrencies,
      };
    }

    let totalScaled: Scaled = ZERO;

    for (const item of totals) {
      const scaledAmount = parseMoney(item.amount);
      if (scaledAmount === ZERO) {
        continue;
      }

      if (item.currency === targetCurrency) {
        totalScaled = add(totalScaled, scaledAmount);
        continue;
      }

      const rate = rates[item.currency]!;
      // In open.er-api.com, rates[C] is the price of 1 baseCurrency in units of C.
      // Therefore, targetAmount = amount_in_C / rate.
      const rateScaled = BigInt(Math.round(rate * RATE_PRECISION_FLOAT));
      if (rateScaled <= 0n) {
        return {
          currency: targetCurrency,
          amount: null,
          isApproximate: true,
          status: ValuationStatus.UNAVAILABLE,
          missingCurrencies: [item.currency],
        };
      }

      const converted = (scaledAmount * RATE_PRECISION_SCALE) / rateScaled;
      totalScaled = add(totalScaled, converted);
    }

    return {
      currency: targetCurrency,
      amount: formatMoney(totalScaled),
      isApproximate: true,
      rateTimestamp: timestamp,
      status: rateStatus,
    };
  }

  private deriveSnapshotDate(timestampUtc: string): string {
    try {
      const d = new Date(timestampUtc);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {
      // ignore
    }
    return new Date().toISOString().slice(0, 10);
  }

  /** Clear the in-memory cache (primarily for unit testing). */
  clearCache(): void {
    this.cache.clear();
    this.failedUntil.clear();
  }
}
