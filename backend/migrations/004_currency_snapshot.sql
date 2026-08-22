-- 004: VND/USD only, with a snapshot exchange rate on every amount (SRS BR-07, BR-07a).
-- Corresponds to SDS §7.1.
--
-- A workspace has one preferred currency; every summary is expressed in it.
-- Accounts and transactions may hold the other supported currency, and each row
-- stores the rate that applied when it was recorded. Rates never restate history,
-- so base_amount / opening_base_balance are generated from the stored snapshot.

-- Anything outside the supported set is normalised to USD before the constraint
-- lands; the seed data only ever used USD.
UPDATE workspaces   SET currency = 'USD' WHERE currency IS NULL OR currency NOT IN ('VND', 'USD');
UPDATE accounts     SET currency = 'USD' WHERE currency NOT IN ('VND', 'USD');
UPDATE transactions SET currency = 'USD' WHERE currency NOT IN ('VND', 'USD');

ALTER TABLE workspaces ALTER COLUMN currency SET NOT NULL;
ALTER TABLE workspaces ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS chk_workspaces_currency,
  ADD CONSTRAINT chk_workspaces_currency CHECK (currency IN ('VND', 'USD'));

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS opening_base_balance NUMERIC(15,2)
    GENERATED ALWAYS AS (opening_balance * exchange_rate) STORED;

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS chk_accounts_currency,
  ADD CONSTRAINT chk_accounts_currency CHECK (currency IN ('VND', 'USD')),
  DROP CONSTRAINT IF EXISTS chk_accounts_exchange_rate,
  ADD CONSTRAINT chk_accounts_exchange_rate CHECK (exchange_rate > 0);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(15,2)
    GENERATED ALWAYS AS (amount * exchange_rate) STORED;

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_transactions_currency,
  ADD CONSTRAINT chk_transactions_currency CHECK (currency IN ('VND', 'USD')),
  DROP CONSTRAINT IF EXISTS chk_transactions_exchange_rate,
  ADD CONSTRAINT chk_transactions_exchange_rate CHECK (exchange_rate > 0);

-- Summaries scan by workspace + date and sum base_amount; keep that path indexed.
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date_status
  ON transactions (workspace_id, date, status);
