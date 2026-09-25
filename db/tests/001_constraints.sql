-- 001_constraints.sql
--
-- Proves the schema's CHECK constraints, partial unique indexes and the budget
-- overlap exclusion actually reject what the business rules say they reject.
-- These rules live in the database because the API is not the only writer, and a
-- rule enforced only in a service layer is one import script away from being
-- bypassed.
--
-- Run against a database with every migration applied:
--   psql -d <db> -v ON_ERROR_STOP=1 -f db/tests/001_constraints.sql
--
-- Every probe prints PASS or aborts the run. The whole suite rolls back, so its fixed-id seed
-- data never persists and the suite can run again on the same database.

\set ON_ERROR_STOP on
SET client_min_messages = NOTICE;

BEGIN;

CREATE OR REPLACE FUNCTION expect_reject(stmt TEXT, label TEXT) RETURNS void AS $$
BEGIN
    BEGIN
        EXECUTE stmt;
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE 'PASS  reject  %', label;
            RETURN;
    END;
    RAISE EXCEPTION 'FAIL  % was ACCEPTED but must be rejected', label;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION expect_accept(stmt TEXT, label TEXT) RETURNS void AS $$
BEGIN
    EXECUTE stmt;
    RAISE NOTICE 'PASS  accept  %', label;
EXCEPTION
    WHEN others THEN
        RAISE EXCEPTION 'FAIL  % was REJECTED (%) but must be accepted', label, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Seed: two users, two wallets (Tam owns one, Linh the other), accounts.
-- ---------------------------------------------------------------------------

INSERT INTO users (id, email, password_hash, display_name, base_currency) VALUES
    ('11111111-1111-1111-1111-111111111111', 'tam@example.com',  'x', 'Tam',  'VND'),
    ('22222222-2222-2222-2222-222222222222', 'linh@example.com', 'x', 'Linh', 'VND');

INSERT INTO wallets (id, owner_user_id, name) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Tam Wallet'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Linh Wallet');

INSERT INTO wallet_members (wallet_id, user_id, role) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'OWNER'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'OWNER');

INSERT INTO accounts (id, wallet_id, name, type, currency, initial_balance) VALUES
    ('a0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vietcombank', 'BANK_ACCOUNT', 'VND', 1000000),
    ('a0000002-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cash',        'CASH',         'VND', 500000),
    ('b0000001-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Techcombank', 'BANK_ACCOUNT', 'VND', 0);

INSERT INTO categories (id, wallet_id, name, type) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Food',   'EXPENSE'),
    ('c0000002-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Salary', 'INCOME'),
    ('c0000003-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Savings', 'TRANSFER');

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

SELECT expect_reject($$
    INSERT INTO users (email, password_hash, display_name, base_currency)
    VALUES ('TAM@example.com', 'x', 'Impostor', 'VND')
$$, 'users: email unique is case-insensitive');

SELECT expect_reject($$
    INSERT INTO users (email, password_hash, display_name, base_currency)
    VALUES ('lower@example.com', 'x', 'Bad', 'vnd')
$$, 'users: lowercase currency code');

-- ---------------------------------------------------------------------------
-- wallet_members: exactly one active owner
-- ---------------------------------------------------------------------------

SELECT expect_reject($$
    INSERT INTO wallet_members (wallet_id, user_id, role)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'OWNER')
$$, 'wallet_members: a second ACTIVE owner');

SELECT expect_accept($$
    INSERT INTO wallet_members (wallet_id, user_id, role, status, relation_label)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'EDITOR', 'ACTIVE', 'Girlfriend')
$$, 'wallet_members: an EDITOR alongside the owner');

SELECT expect_reject($$
    INSERT INTO wallet_members (wallet_id, user_id, role)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'VIEWER')
$$, 'wallet_members: the same user twice on one wallet');

SELECT expect_reject($$
    INSERT INTO wallet_members (wallet_id, user_id, role)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'ADMIN')
$$, 'wallet_members: a role outside OWNER/EDITOR/VIEWER');

-- A revoked owner must not block appointing a new one.
SELECT expect_accept($$
    UPDATE wallet_members SET status = 'REVOKED'
    WHERE wallet_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND role = 'OWNER'
$$, 'wallet_members: revoking an owner');

SELECT expect_accept($$
    INSERT INTO wallet_members (wallet_id, user_id, role)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'OWNER')
$$, 'wallet_members: a new owner once the old one is REVOKED');

-- ---------------------------------------------------------------------------
-- wallet_invitations
-- ---------------------------------------------------------------------------

SELECT expect_reject($$
    INSERT INTO wallet_invitations (wallet_id, invited_email, role, token_hash, expires_at, created_by_user_id)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x@example.com', 'OWNER', 'h1', NOW() + INTERVAL '7 days', '11111111-1111-1111-1111-111111111111')
$$, 'wallet_invitations: inviting straight to OWNER');

SELECT expect_accept($$
    INSERT INTO wallet_invitations (wallet_id, invited_email, role, token_hash, expires_at, created_by_user_id)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mom@example.com', 'VIEWER', 'h2', NOW() + INTERVAL '7 days', '11111111-1111-1111-1111-111111111111')
$$, 'wallet_invitations: a first open invite');

SELECT expect_reject($$
    INSERT INTO wallet_invitations (wallet_id, invited_email, role, token_hash, expires_at, created_by_user_id)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MOM@example.com', 'EDITOR', 'h3', NOW() + INTERVAL '7 days', '11111111-1111-1111-1111-111111111111')
$$, 'wallet_invitations: a second open invite to the same email');

SELECT expect_accept($$
    UPDATE wallet_invitations SET revoked_at = NOW() WHERE token_hash = 'h2'
$$, 'wallet_invitations: revoking an invite');

SELECT expect_accept($$
    INSERT INTO wallet_invitations (wallet_id, invited_email, role, token_hash, expires_at, created_by_user_id)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mom@example.com', 'EDITOR', 'h4', NOW() + INTERVAL '7 days', '11111111-1111-1111-1111-111111111111')
$$, 'wallet_invitations: re-inviting once the old invite is revoked');

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

SELECT expect_reject($$
    INSERT INTO accounts (wallet_id, name, type, currency)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Crypto', 'BROKERAGE', 'VND')
$$, 'accounts: a type outside the allowed set');

SELECT expect_accept($$
    INSERT INTO accounts (wallet_id, name, type, currency, initial_balance)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Visa', 'CREDIT_CARD', 'VND', -2000000)
$$, 'accounts: a credit card opening negative');

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

SELECT expect_reject($$
    INSERT INTO categories (wallet_id, name, type)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'food', 'EXPENSE')
$$, 'categories: duplicate name at the same level');

SELECT expect_accept($$
    INSERT INTO categories (wallet_id, parent_id, name, type)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001', 'Restaurant', 'EXPENSE')
$$, 'categories: a child under Food');

SELECT expect_accept($$
    INSERT INTO categories (wallet_id, name, type)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Food', 'EXPENSE')
$$, 'categories: the same name in a different wallet');

SELECT expect_reject($$
    INSERT INTO categories (id, wallet_id, parent_id, name, type)
    VALUES ('c0000009-0000-0000-0000-000000000009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'c0000009-0000-0000-0000-000000000009', 'Loop', 'EXPENSE')
$$, 'categories: a category as its own parent');

-- ---------------------------------------------------------------------------
-- transactions: shape per type
-- ---------------------------------------------------------------------------

SELECT expect_accept($$
    INSERT INTO transactions (created_by_user_id, to_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'c0000002-0000-0000-0000-000000000002', 'INCOME', 15000000, 'VND', NOW())
$$, 'transactions: a well-formed INCOME');

SELECT expect_accept($$
    INSERT INTO transactions (created_by_user_id, from_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'c0000001-0000-0000-0000-000000000001', 'EXPENSE', 150000, 'VND', NOW())
$$, 'transactions: a well-formed EXPENSE');

-- The whole point of the wallet model: paying your partner back is a transfer.
SELECT expect_accept($$
    INSERT INTO transactions (created_by_user_id, from_account_id, to_account_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'b0000001-0000-0000-0000-000000000001', 'TRANSFER', 500000, 'VND', NOW())
$$, 'transactions: a cross-wallet TRANSFER');

SELECT expect_reject($$
    INSERT INTO transactions (created_by_user_id, from_account_id, to_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'a0000002-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001',
            'EXPENSE', 1000, 'VND', NOW())
$$, 'transactions: an EXPENSE that also names a destination');

SELECT expect_reject($$
    INSERT INTO transactions (created_by_user_id, from_account_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'EXPENSE', 1000, 'VND', NOW())
$$, 'transactions: an EXPENSE with no category');

-- The category is optional on a transfer (005_transfer_categories.sql); that it is a
-- TRANSFER-typed one is a service check, like INCOME/EXPENSE matching.
SELECT expect_accept($$
    INSERT INTO transactions (created_by_user_id, from_account_id, to_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'a0000002-0000-0000-0000-000000000002', 'c0000003-0000-0000-0000-000000000003',
            'TRANSFER', 1000, 'VND', NOW())
$$, 'transactions: a TRANSFER carrying a category');

SELECT expect_reject($$
    INSERT INTO transactions (created_by_user_id, from_account_id, to_account_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'a0000001-0000-0000-0000-000000000001', 'TRANSFER', 1000, 'VND', NOW())
$$, 'transactions: a TRANSFER from an account to itself');

SELECT expect_reject($$
    INSERT INTO transactions (created_by_user_id, from_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'c0000001-0000-0000-0000-000000000001', 'EXPENSE', 0, 'VND', NOW())
$$, 'transactions: a zero amount');

SELECT expect_reject($$
    INSERT INTO transactions (created_by_user_id, from_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'c0000001-0000-0000-0000-000000000001', 'EXPENSE', -500, 'VND', NOW())
$$, 'transactions: a negative amount');

-- ---------------------------------------------------------------------------
-- budgets: one active budget per category per overlapping window
-- ---------------------------------------------------------------------------

SELECT expect_accept($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001',
            'Food August', 3000000, 'VND', 'MONTHLY', '2026-08-01', '2026-08-31')
$$, 'budgets: a first August food budget');

SELECT expect_reject($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001',
            'Food mid-August', 1000000, 'VND', 'CUSTOM', '2026-08-15', '2026-09-15')
$$, 'budgets: an overlapping active budget on the same category');

SELECT expect_accept($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001',
            'Food September', 3000000, 'VND', 'MONTHLY', '2026-09-01', '2026-09-30')
$$, 'budgets: an adjacent, non-overlapping period');

SELECT expect_accept($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date, status)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001',
            'Food August (old)', 2000000, 'VND', 'MONTHLY', '2026-08-01', '2026-08-31', 'ARCHIVED')
$$, 'budgets: an ARCHIVED budget overlapping an active one');

SELECT expect_reject($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000002-0000-0000-0000-000000000002',
            'Backwards', 1000, 'VND', 'CUSTOM', '2026-10-31', '2026-10-01')
$$, 'budgets: end_date before start_date');

-- ---------------------------------------------------------------------------
-- goals & contributions
-- ---------------------------------------------------------------------------

INSERT INTO goals (id, wallet_id, name, target_amount, currency, target_date) VALUES
    ('40000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'New Laptop', 30000000, 'VND', '2027-01-01');

SELECT expect_reject($$
    INSERT INTO goals (wallet_id, name, target_amount, currency)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Impossible', 0, 'VND')
$$, 'goals: a zero target amount');

SELECT expect_accept($$
    INSERT INTO goal_contributions (goal_id, account_id, amount, currency, contribution_date)
    VALUES ('40000001-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002',
            12000000, 'VND', NOW())
$$, 'goal_contributions: a standalone contribution');

-- One contribution per transaction: linking the same transaction twice would
-- double-count a goal's progress.
INSERT INTO transactions (id, created_by_user_id, from_account_id, category_id, type, amount, currency, transaction_date)
VALUES ('70000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
        'EXPENSE', 1000000, 'VND', NOW());

SELECT expect_accept($$
    INSERT INTO goal_contributions (goal_id, account_id, transaction_id, amount, currency, contribution_date)
    VALUES ('40000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
            '70000001-0000-0000-0000-000000000001', 1000000, 'VND', NOW())
$$, 'goal_contributions: a transaction-backed contribution');

SELECT expect_reject($$
    INSERT INTO goal_contributions (goal_id, account_id, transaction_id, amount, currency, contribution_date)
    VALUES ('40000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
            '70000001-0000-0000-0000-000000000001', 1000000, 'VND', NOW())
$$, 'goal_contributions: the same transaction linked twice');

-- ---------------------------------------------------------------------------
-- Derived reads: printed for a human reading the run, not asserted. The API's own balance,
-- spent and dashboard SQL is asserted over HTTP in server/test/integration.{ledger,planning}.test.ts.
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- Derived: account balances (initial + income - expense + in - out) ---'
SELECT a.name,
       a.initial_balance
         + COALESCE((SELECT SUM(t.amount) FROM transactions t
                     WHERE t.to_account_id = a.id AND t.status = 'COMPLETED'), 0)
         - COALESCE((SELECT SUM(t.amount) FROM transactions t
                     WHERE t.from_account_id = a.id AND t.status = 'COMPLETED'), 0)
       AS balance
FROM accounts a
ORDER BY a.name;

\echo ''
\echo '--- Derived: budget spent / remaining ---'
SELECT b.name, b.amount,
       COALESCE(SUM(t.amount), 0) AS spent,
       b.amount - COALESCE(SUM(t.amount), 0) AS remaining
FROM budgets b
LEFT JOIN transactions t
       ON t.category_id = b.category_id
      AND t.type = 'EXPENSE'
      AND t.status = 'COMPLETED'
      AND t.transaction_date::date BETWEEN b.start_date AND b.end_date
WHERE b.status = 'ACTIVE'
GROUP BY b.id, b.name, b.amount
ORDER BY b.name;

\echo ''
\echo '--- Derived: goal progress ---'
SELECT g.name, g.target_amount,
       COALESCE(SUM(gc.amount), 0) AS current_amount,
       GREATEST(g.target_amount - COALESCE(SUM(gc.amount), 0), 0) AS remaining,
       LEAST(ROUND(COALESCE(SUM(gc.amount), 0) * 100.0 / g.target_amount, 1), 100) AS progress_pct
FROM goals g
LEFT JOIN goal_contributions gc ON gc.goal_id = g.id
GROUP BY g.id, g.name, g.target_amount;

\echo ''
\echo '--- Critical rule: a transfer is not spending ---'
SELECT
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'EXPENSE'  AND status = 'COMPLETED') AS total_expense,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'TRANSFER' AND status = 'COMPLETED') AS total_transfer;

ROLLBACK;

\echo ''
\echo 'All constraint probes passed.'
