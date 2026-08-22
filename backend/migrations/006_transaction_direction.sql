-- 006: record which way each transaction moved its account (SDS §7.1).
--
-- `amount` is always positive, and both legs of a TRANSFER are stored as
-- type='TRANSFER', so nothing in the table said which leg reduced its account.
-- The application inferred it from insertion order (lowest id in the transfer
-- group = the debit), which no query outside that code path could reproduce: a
-- per-account balance could not be rebuilt from the rows at all.
--
-- Direction makes the sign explicit and belongs to the row, not to an ordering
-- convention.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS direction VARCHAR(6);

-- Plain transactions: direction follows the type.
UPDATE transactions
   SET direction = CASE
         WHEN type IN ('INCOME', 'REFUND', 'DEBT') THEN 'credit'
         ELSE 'debit'
       END
 WHERE direction IS NULL
   AND type <> 'TRANSFER';

-- Transfer legs: backfill with the same rule the application used until now —
-- within a group the lower id is the debit. This is the only information the
-- existing rows carry, so it is the best available reconstruction.
UPDATE transactions t
   SET direction = CASE
         WHEN t.id = (
           SELECT MIN(g.id) FROM transactions g
            WHERE g.transfer_group_id = t.transfer_group_id
         ) THEN 'debit'
         ELSE 'credit'
       END
 WHERE t.direction IS NULL
   AND t.type = 'TRANSFER'
   AND t.transfer_group_id IS NOT NULL;

-- A TRANSFER with no group cannot be placed; treat it as a debit so the column
-- can be NOT NULL. There should be none — transfers are only ever created in pairs.
UPDATE transactions SET direction = 'debit' WHERE direction IS NULL;

ALTER TABLE transactions ALTER COLUMN direction SET NOT NULL;

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_transactions_direction,
  ADD CONSTRAINT chk_transactions_direction CHECK (direction IN ('debit', 'credit'));

-- Per-account balance reconstruction groups by account and direction.
CREATE INDEX IF NOT EXISTS idx_transactions_account_direction
  ON transactions (account_id, direction, status);
