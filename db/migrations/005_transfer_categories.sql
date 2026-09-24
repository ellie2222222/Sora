-- 005_transfer_categories.sql
--
-- Adds a TRANSFER category type so a transfer can say what it was for
-- ("Savings", "Debt Repayment"). The category stays optional on a transfer,
-- and a transfer still never counts as income or expense (BR-06): every
-- income/expense/budget figure filters on the transaction's own type.
--
-- As with INCOME/EXPENSE, matching a category's type to its transaction's type
-- is a service check, not a constraint — a CHECK cannot read another table.
--

BEGIN;

ALTER TABLE categories DROP CONSTRAINT chk_category_type;
ALTER TABLE categories ADD CONSTRAINT chk_category_type
    CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER'));

ALTER TABLE transactions DROP CONSTRAINT chk_transaction_shape;
ALTER TABLE transactions ADD CONSTRAINT chk_transaction_shape CHECK (
    (type = 'INCOME'
        AND from_account_id IS NULL
        AND to_account_id IS NOT NULL
        AND category_id IS NOT NULL)
    OR
    (type = 'EXPENSE'
        AND from_account_id IS NOT NULL
        AND to_account_id IS NULL
        AND category_id IS NOT NULL)
    OR
    (type = 'TRANSFER'
        AND from_account_id IS NOT NULL
        AND to_account_id IS NOT NULL
        AND from_account_id <> to_account_id)
);

-- Existing wallets get the same starter transfer set a new wallet is seeded with
-- (packages/contracts/src/starter-categories.ts). A wallet that already has a
-- same-named root category keeps its own: uq_category_name_per_parent rejects
-- the duplicate and DO NOTHING skips it.
INSERT INTO categories (wallet_id, name, type, icon, color)
SELECT wallets.id, starter.name, 'TRANSFER', starter.icon, starter.color
FROM wallets
CROSS JOIN (VALUES
    ('Savings',             'piggy-bank',  '#0EA5E9'),
    ('Debt Repayment',      'handshake',   '#6366F1'),
    ('Credit Card Payment', 'credit-card', '#64748B'),
    ('Top Up',              'wallet',      '#14B8A6'),
    ('Cash Withdrawal',     'landmark',    '#78716C')
) AS starter (name, icon, color)
ON CONFLICT DO NOTHING;

COMMIT;
