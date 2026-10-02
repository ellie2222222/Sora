BEGIN;

-- 009_add_goal_to_transactions.sql
-- Add goal_id to transactions to allow tracking expenses against a specific goal.

ALTER TABLE transactions
    ADD COLUMN goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_goal ON transactions (goal_id);

COMMIT;
