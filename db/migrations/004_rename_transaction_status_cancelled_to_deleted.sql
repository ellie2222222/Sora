-- 004_rename_transaction_status_cancelled_to_deleted.sql
--
-- Renames the transaction status value CANCELLED to DELETED. The mechanism is
-- unchanged (the row stays, only COMPLETED transactions count toward derived
-- figures) — only the label changes, to match the product's "delete a
-- transaction" language instead of "cancel a transaction".
--

BEGIN;

-- Must run before the constraint swap below: any row still CANCELLED would violate the new CHECK.
UPDATE transactions SET status = 'DELETED' WHERE status = 'CANCELLED';

ALTER TABLE transactions DROP CONSTRAINT chk_transaction_status;
ALTER TABLE transactions ADD CONSTRAINT chk_transaction_status
    CHECK (status IN ('PENDING', 'COMPLETED', 'DELETED'));

COMMIT;
