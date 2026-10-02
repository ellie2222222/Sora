BEGIN;

-- 012_validate_budget_kind_and_transaction_goal.sql
-- Its own file, so 011's lock is released before existing rows are scanned.
-- Fails on any row 011's rules reject; fix that row by hand rather than editing this file.

ALTER TABLE budgets VALIDATE CONSTRAINT chk_budget_kind;
ALTER TABLE transactions VALIDATE CONSTRAINT chk_transaction_goal;

COMMIT;
