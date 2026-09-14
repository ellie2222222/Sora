-- 003_exchange_rate_snapshots.sql
--
-- Persistent daily exchange-rate history for reproducible historical valuation
-- and stale-rate fallback when external exchange providers are unreachable.
--

BEGIN;

CREATE TABLE IF NOT EXISTS exchange_rate_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  base_currency VARCHAR(3) NOT NULL,
  rates JSONB NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'open.er-api.com',
  fetched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exchange_rate_snapshot_date_currency UNIQUE (snapshot_date, base_currency)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_snapshots_lookup
  ON exchange_rate_snapshots (base_currency, snapshot_date DESC);

COMMIT;
