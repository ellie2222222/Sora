-- 004_transaction_status_active.sql
--
-- A transaction is ACTIVE or DELETED. PENDING and COMPLETED are gone: every live entry counts
-- toward every derived figure, so a former PENDING row starts counting once this applies.

BEGIN;

ALTER TABLE transactions DROP CONSTRAINT chk_transaction_status;

UPDATE transactions SET status = 'ACTIVE' WHERE status IN ('PENDING', 'COMPLETED');

ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'ACTIVE';
ALTER TABLE transactions ADD CONSTRAINT chk_transaction_status
    CHECK (status IN ('ACTIVE', 'DELETED'));

-- Budget "spent" scans live expenses for a category over a date window.
DROP INDEX idx_transactions_budget_scan;
CREATE INDEX idx_transactions_budget_scan
    ON transactions (category_id, transaction_date)
    WHERE type = 'EXPENSE' AND status = 'ACTIVE';

COMMIT;
