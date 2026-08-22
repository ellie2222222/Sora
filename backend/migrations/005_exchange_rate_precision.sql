-- 005: widen the snapshot exchange rate to 10 decimal places (SRS BR-07a).
-- Corresponds to SDS §7.1.
--
-- The rate converts a row's own currency into the workspace preferred currency,
-- so it is held in both directions: USD->VND is ~26183.58, but VND->USD is
-- ~0.0000382. At 6 decimal places the latter rounds to 0.000038 — a 0.5% error
-- on every VND amount booked in a USD workspace. Ten places keeps both
-- directions exact enough to book money at.
--
-- base_amount / opening_base_balance are generated from exchange_rate, and
-- Postgres refuses to alter the type of a column a generated column depends on.
-- They are dropped and re-added, which recomputes them — nothing is lost,
-- because they hold no independent data.

ALTER TABLE accounts DROP COLUMN IF EXISTS opening_base_balance;
ALTER TABLE accounts ALTER COLUMN exchange_rate TYPE NUMERIC(18,10);
ALTER TABLE accounts
  ADD COLUMN opening_base_balance NUMERIC(15,2)
    GENERATED ALWAYS AS (opening_balance * exchange_rate) STORED;

ALTER TABLE transactions DROP COLUMN IF EXISTS base_amount;
ALTER TABLE transactions ALTER COLUMN exchange_rate TYPE NUMERIC(18,10);
ALTER TABLE transactions
  ADD COLUMN base_amount NUMERIC(15,2)
    GENERATED ALWAYS AS (amount * exchange_rate) STORED;
