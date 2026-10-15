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

-- Passes only when the named constraint rejects the row: any other error would let a probe pass
-- while the rule it names enforces nothing. A NOT NULL has no name, so it is 'not null <column>'.
CREATE OR REPLACE FUNCTION expect_violation(stmt TEXT, expected TEXT, label TEXT) RETURNS void AS $$
DECLARE
    violated_constraint TEXT;
    violated_column TEXT;
    violated TEXT;
BEGIN
    BEGIN
        EXECUTE stmt;
    EXCEPTION
        WHEN integrity_constraint_violation THEN
            GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME, violated_column = COLUMN_NAME;
            violated := COALESCE(NULLIF(violated_constraint, ''), 'not null ' || violated_column);
            IF violated = expected THEN
                RAISE NOTICE 'PASS  reject  % (%)', label, violated;
                RETURN;
            END IF;
            RAISE EXCEPTION 'FAIL  % was rejected by % but must be by %', label, violated, expected;
    END;
    RAISE EXCEPTION 'FAIL  % was ACCEPTED but must be rejected by %', label, expected;
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

INSERT INTO wallets (id, owner_user_id, name, time_zone) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Tam Wallet', 'Asia/Ho_Chi_Minh'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Linh Wallet', 'Asia/Ho_Chi_Minh');

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

SELECT expect_violation($$
    INSERT INTO users (email, password_hash, display_name, base_currency)
    VALUES ('TAM@example.com', 'x', 'Impostor', 'VND')
$$, 'uq_users_email', 'users: email unique is case-insensitive');

SELECT expect_violation($$
    INSERT INTO users (email, password_hash, display_name, base_currency)
    VALUES ('lower@example.com', 'x', 'Bad', 'vnd')
$$, 'chk_user_currency', 'users: lowercase currency code');

-- ---------------------------------------------------------------------------
-- wallet_members: exactly one active owner
-- ---------------------------------------------------------------------------

SELECT expect_violation($$
    INSERT INTO wallet_members (wallet_id, user_id, role)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'OWNER')
$$, 'uq_wallet_single_owner', 'wallet_members: a second ACTIVE owner');

SELECT expect_accept($$
    INSERT INTO wallet_members (wallet_id, user_id, role, status, relation_label)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'EDITOR', 'ACTIVE', 'Girlfriend')
$$, 'wallet_members: an EDITOR alongside the owner');

SELECT expect_violation($$
    INSERT INTO wallet_members (wallet_id, user_id, role)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'VIEWER')
$$, 'uq_wallet_member', 'wallet_members: the same user twice on one wallet');

SELECT expect_violation($$
    INSERT INTO wallet_members (wallet_id, user_id, role)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'ADMIN')
$$, 'chk_wallet_member_role', 'wallet_members: a role outside OWNER/EDITOR/VIEWER');

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

SELECT expect_violation($$
    INSERT INTO wallet_invitations (wallet_id, invited_email, role, token_hash, expires_at, created_by_user_id)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x@example.com', 'OWNER', 'h1', NOW() + INTERVAL '7 days', '11111111-1111-1111-1111-111111111111')
$$, 'chk_invitation_role', 'wallet_invitations: inviting straight to OWNER');

SELECT expect_accept($$
    INSERT INTO wallet_invitations (wallet_id, invited_email, role, token_hash, expires_at, created_by_user_id)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mom@example.com', 'VIEWER', 'h2', NOW() + INTERVAL '7 days', '11111111-1111-1111-1111-111111111111')
$$, 'wallet_invitations: a first open invite');

SELECT expect_violation($$
    INSERT INTO wallet_invitations (wallet_id, invited_email, role, token_hash, expires_at, created_by_user_id)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MOM@example.com', 'EDITOR', 'h3', NOW() + INTERVAL '7 days', '11111111-1111-1111-1111-111111111111')
$$, 'uq_wallet_invitation_open', 'wallet_invitations: a second open invite to the same email');

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

SELECT expect_violation($$
    INSERT INTO accounts (wallet_id, name, type, currency)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Crypto', 'BROKERAGE', 'VND')
$$, 'chk_account_type', 'accounts: a type outside the allowed set');

SELECT expect_accept($$
    INSERT INTO accounts (wallet_id, name, type, currency, initial_balance)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Visa', 'CREDIT_CARD', 'VND', -2000000)
$$, 'accounts: a credit card opening negative');

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

SELECT expect_violation($$
    INSERT INTO categories (wallet_id, name, type)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'food', 'EXPENSE')
$$, 'uq_category_name_per_parent', 'categories: duplicate name at the same level');

SELECT expect_accept($$
    INSERT INTO categories (wallet_id, parent_id, name, type)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001', 'Restaurant', 'EXPENSE')
$$, 'categories: a child under Food');

SELECT expect_accept($$
    INSERT INTO categories (wallet_id, name, type)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Food', 'EXPENSE')
$$, 'categories: the same name in a different wallet');

SELECT expect_violation($$
    INSERT INTO categories (id, wallet_id, parent_id, name, type)
    VALUES ('c0000009-0000-0000-0000-000000000009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'c0000009-0000-0000-0000-000000000009', 'Loop', 'EXPENSE')
$$, 'chk_category_not_own_parent', 'categories: a category as its own parent');

SELECT expect_accept($$
    INSERT INTO categories (wallet_id, system_key, name, type)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'groceries', 'Groceries', 'EXPENSE')
$$, 'categories: a starter category with its system key');

SELECT expect_violation($$
    INSERT INTO categories (wallet_id, system_key, name, type)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'groceries', 'Groceries (copy)', 'EXPENSE')
$$, 'uq_category_system_key', 'categories: a second copy of one starter in the same wallet');

SELECT expect_accept($$
    INSERT INTO categories (wallet_id, system_key, name, type)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'groceries', 'Groceries', 'EXPENSE')
$$, 'categories: the same starter in a different wallet');

-- ---------------------------------------------------------------------------
-- category_translations
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (
        SELECT locale FROM category_translations GROUP BY locale
        HAVING COUNT(*) <> (SELECT COUNT(*) FROM category_translations WHERE locale = 'en')
    ) OR (SELECT COUNT(DISTINCT locale) FROM category_translations) <> 10 THEN
        RAISE EXCEPTION 'FAIL  category_translations: every starter key is named in all ten locales';
    END IF;
    RAISE NOTICE 'PASS  category_translations: every starter key is named in all ten locales';
END;
$$;

SELECT expect_violation($$
    INSERT INTO category_translations (system_key, locale, name) VALUES ('food', 'vi', 'Đồ ăn')
$$, 'uq_category_translation', 'category_translations: a second name for one key and locale');

SELECT expect_violation($$
    INSERT INTO category_translations (system_key, locale, name) VALUES ('food', 'pt', 'Alimentação')
$$, 'chk_category_translation_locale', 'category_translations: a locale outside LOCALES');

-- ---------------------------------------------------------------------------
-- wallets.time_zone
-- ---------------------------------------------------------------------------

SELECT expect_accept($$
    UPDATE wallets SET time_zone = 'America/Los_Angeles' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
$$, 'wallets: an IANA time zone');

SELECT expect_violation($$
    UPDATE wallets SET time_zone = '+07:00' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
$$, 'chk_wallet_time_zone', 'wallets: a fixed offset instead of an IANA name');

SELECT expect_violation($$
    UPDATE wallets SET time_zone = 'Mars/Olympus_Mons' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
$$, 'chk_wallet_time_zone', 'wallets: an unknown time zone name');

SELECT expect_violation($$
    INSERT INTO wallets (owner_user_id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'No zone')
$$, 'not null time_zone', 'wallets: a wallet without a time zone');

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

SELECT expect_violation($$
    INSERT INTO transactions (created_by_user_id, from_account_id, to_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'a0000002-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001',
            'EXPENSE', 1000, 'VND', NOW())
$$, 'chk_transaction_shape', 'transactions: an EXPENSE that also names a destination');

SELECT expect_violation($$
    INSERT INTO transactions (created_by_user_id, from_account_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'EXPENSE', 1000, 'VND', NOW())
$$, 'chk_transaction_shape', 'transactions: an EXPENSE with no category');

-- The category is optional on a transfer; that it is a
-- TRANSFER-typed one is a service check, like INCOME/EXPENSE matching.
SELECT expect_accept($$
    INSERT INTO transactions (created_by_user_id, from_account_id, to_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'a0000002-0000-0000-0000-000000000002', 'c0000003-0000-0000-0000-000000000003',
            'TRANSFER', 1000, 'VND', NOW())
$$, 'transactions: a TRANSFER carrying a category');

SELECT expect_violation($$
    INSERT INTO transactions (created_by_user_id, from_account_id, to_account_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'a0000001-0000-0000-0000-000000000001', 'TRANSFER', 1000, 'VND', NOW())
$$, 'chk_transaction_shape', 'transactions: a TRANSFER from an account to itself');

SELECT expect_violation($$
    INSERT INTO transactions (created_by_user_id, from_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'c0000001-0000-0000-0000-000000000001', 'EXPENSE', 0, 'VND', NOW())
$$, 'chk_transaction_amount', 'transactions: a zero amount');

SELECT expect_violation($$
    INSERT INTO transactions (created_by_user_id, from_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'c0000001-0000-0000-0000-000000000001', 'EXPENSE', -500, 'VND', NOW())
$$, 'chk_transaction_amount', 'transactions: a negative amount');

-- ---------------------------------------------------------------------------
-- budgets: one budget per category per overlapping window
-- ---------------------------------------------------------------------------

SELECT expect_accept($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001',
            'Food August', 3000000, 'VND', 'CUSTOM', '2026-08-01', '2026-08-31')
$$, 'budgets: a first August food budget');

SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001',
            'Food mid-August', 1000000, 'VND', 'CUSTOM', '2026-08-15', '2026-09-15')
$$, 'excl_budget_category_overlap', 'budgets: an overlapping budget on the same category');

SELECT expect_accept($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001',
            'Food September', 3000000, 'VND', 'CUSTOM', '2026-09-01', '2026-09-30')
$$, 'budgets: an adjacent, non-overlapping period');

-- 013: a repeating period has no end_date, a fixed one must have one.
SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000002-0000-0000-0000-000000000002',
            'Monthly with an end', 1000, 'VND', 'MONTHLY', '2030-01-01', '2030-01-31')
$$, 'chk_budget_end', 'budgets: a MONTHLY budget with an end_date (chk_budget_end)');

SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000002-0000-0000-0000-000000000002',
            'Custom without an end', 1000, 'VND', 'CUSTOM', '2030-01-01', NULL)
$$, 'chk_budget_end', 'budgets: a CUSTOM budget with no end_date (chk_budget_end)');

SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000002-0000-0000-0000-000000000002',
            'Backwards', 1000, 'VND', 'CUSTOM', '2026-10-31', '2026-10-01')
$$, 'chk_budget_dates', 'budgets: end_date before start_date');

-- ---------------------------------------------------------------------------
-- goals & contributions
-- ---------------------------------------------------------------------------

INSERT INTO goals (id, wallet_id, name, target_amount, currency, target_date) VALUES
    ('40000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'New Laptop', 30000000, 'VND', '2027-01-01');

SELECT expect_violation($$
    INSERT INTO goals (wallet_id, name, target_amount, currency)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Impossible', 0, 'VND')
$$, 'chk_goal_target', 'goals: a zero target amount');

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

SELECT expect_violation($$
    INSERT INTO goal_contributions (goal_id, account_id, transaction_id, amount, currency, contribution_date)
    VALUES ('40000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
            '70000001-0000-0000-0000-000000000001', 1000000, 'VND', NOW())
$$, 'goal_contributions_transaction_id_key', 'goal_contributions: the same transaction linked twice');

-- ---------------------------------------------------------------------------
-- budgets by kind (008, 010): each kind has its own overlap rule, and kinds never block each other
-- ---------------------------------------------------------------------------

SELECT expect_accept($$
    INSERT INTO budgets (wallet_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Whole wallet, 1 Nov', 500000, 'VND', 'CUSTOM', '2026-11-01', '2026-11-01')
$$, 'budgets: a wallet-wide one-day budget, with no category and no goal');

SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Whole wallet, November', 9000000, 'VND', 'CUSTOM', '2026-11-01', '2026-11-30')
$$, 'excl_budget_overall_overlap', 'budgets: a second wallet-wide budget overlapping the first');

SELECT expect_accept($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001',
            'Food November', 3000000, 'VND', 'CUSTOM', '2026-11-01', '2026-11-30')
$$, 'budgets: a category budget over the same days as a wallet-wide one');

SELECT expect_accept($$
    INSERT INTO budgets (wallet_id, goal_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '40000001-0000-0000-0000-000000000001',
            'Laptop fund', 10000000, 'VND', 'GOAL', '2026-11-01', '2026-12-31')
$$, 'budgets: a GOAL budget tied to a goal');

SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, goal_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '40000001-0000-0000-0000-000000000001',
            'Laptop fund, December', 2000000, 'VND', 'GOAL', '2026-12-01', '2026-12-31')
$$, 'excl_budget_goal_overlap', 'budgets: a second budget on the same goal overlapping the first');

SELECT expect_accept($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000002-0000-0000-0000-000000000002',
            'Every year from 2027', 90000000, 'VND', 'YEARLY', '2027-01-01', NULL)
$$, 'budgets: a repeating YEARLY budget with no end_date');

SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, category_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000002-0000-0000-0000-000000000002',
            'June 2031', 1000, 'VND', 'CUSTOM', '2031-06-01', '2031-06-30')
$$, 'excl_budget_category_overlap', 'budgets: a fixed budget years after a repeating one began on the same category');

SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hourly', 1000, 'VND', 'HOURLY', '2028-01-01', '2028-01-01')
$$, 'chk_budget_period', 'budgets: a period type outside chk_budget_period');

-- 011: a budget is exactly one kind, and only an expense carries a goal tag.
SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, category_id, goal_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000001-0000-0000-0000-000000000001', '40000001-0000-0000-0000-000000000001',
            'Both', 1000, 'VND', 'GOAL', '2029-01-01', '2029-01-31')
$$, 'chk_budget_kind', 'budgets: naming both a category and a goal');

SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Goal period, no goal', 1000, 'VND', 'GOAL', '2029-02-01', '2029-02-28')
$$, 'chk_budget_kind', 'budgets: the GOAL period without a goal');

SELECT expect_violation($$
    INSERT INTO budgets (wallet_id, goal_id, name, amount, currency, period_type, start_date, end_date)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '40000001-0000-0000-0000-000000000001',
            'Goal, monthly', 1000, 'VND', 'MONTHLY', '2029-03-01', NULL)
$$, 'chk_budget_kind', 'budgets: a goal with a period other than GOAL');

SELECT expect_accept($$
    INSERT INTO transactions (created_by_user_id, from_account_id, category_id, goal_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'c0000001-0000-0000-0000-000000000001', '40000001-0000-0000-0000-000000000001', 'EXPENSE', 1000, 'VND', NOW())
$$, 'transactions: an EXPENSE tagged with a goal');

SELECT expect_violation($$
    INSERT INTO transactions (created_by_user_id, to_account_id, category_id, goal_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'c0000002-0000-0000-0000-000000000002', '40000001-0000-0000-0000-000000000001', 'INCOME', 1000, 'VND', NOW())
$$, 'chk_transaction_goal', 'transactions: an INCOME tagged with a goal');

-- ---------------------------------------------------------------------------
-- Single-column rules: each existing row moved to a value its own CHECK refuses
-- chk_transaction_type has no probe: chk_transaction_shape rejects an unknown type first, and the
-- parity script holds its members to TRANSACTION_TYPES.
-- ---------------------------------------------------------------------------

SELECT expect_violation($$
    INSERT INTO users (email, display_name, base_currency)
    VALUES ('nocredential@example.invalid', 'Nobody', 'VND')
$$, 'chk_user_has_credential', 'users: neither a password nor a Google identity');

SELECT expect_violation($$
    INSERT INTO users (email, google_id, display_name, base_currency) VALUES
        ('google-a@example.invalid', 'google-dup', 'A', 'VND'),
        ('google-b@example.invalid', 'google-dup', 'B', 'VND')
$$, 'uq_users_google_id', 'users: one Google identity on two users');

SELECT expect_violation($$
    UPDATE users SET theme = 'neon' WHERE id = '11111111-1111-1111-1111-111111111111'
$$, 'chk_user_theme', 'users: a theme outside the palette');

SELECT expect_violation($$
    UPDATE users SET locale = 'pt' WHERE id = '11111111-1111-1111-1111-111111111111'
$$, 'chk_user_locale', 'users: a locale outside LOCALES');

SELECT expect_violation($$
    UPDATE wallets SET status = 'DELETED' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
$$, 'chk_wallet_status', 'wallets: a status outside ACTIVE/ARCHIVED');

SELECT expect_violation($$
    UPDATE wallet_members SET status = 'PENDING' WHERE wallet_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '11111111-1111-1111-1111-111111111111'
$$, 'chk_wallet_member_status', 'wallet_members: a PENDING member row (rule 6)');

SELECT expect_violation($$
    UPDATE accounts SET currency = 'vnd' WHERE id = 'a0000001-0000-0000-0000-000000000001'
$$, 'chk_account_currency', 'accounts: a lowercase currency code');

SELECT expect_violation($$
    UPDATE accounts SET status = 'CLOSED' WHERE id = 'a0000001-0000-0000-0000-000000000001'
$$, 'chk_account_status', 'accounts: a status outside ACTIVE/ARCHIVED');

SELECT expect_violation($$
    UPDATE categories SET type = 'SAVING' WHERE id = 'c0000001-0000-0000-0000-000000000001'
$$, 'chk_category_type', 'categories: a type outside INCOME/EXPENSE/TRANSFER');

SELECT expect_violation($$
    UPDATE categories SET status = 'DELETED' WHERE id = 'c0000001-0000-0000-0000-000000000001'
$$, 'chk_category_status', 'categories: a status outside ACTIVE/ARCHIVED');

SELECT expect_violation($$
    UPDATE transactions SET currency = 'vnd' WHERE id = (SELECT id FROM transactions ORDER BY id LIMIT 1)
$$, 'chk_transaction_currency', 'transactions: a lowercase currency code');

SELECT expect_violation($$
    UPDATE transactions SET status = 'PENDING' WHERE id = (SELECT id FROM transactions ORDER BY id LIMIT 1)
$$, 'chk_transaction_status', 'transactions: PENDING, which no longer exists (only ACTIVE/DELETED)');

SELECT expect_violation($$
    UPDATE transactions SET status = 'COMPLETED' WHERE id = (SELECT id FROM transactions ORDER BY id LIMIT 1)
$$, 'chk_transaction_status', 'transactions: COMPLETED, which no longer exists (only ACTIVE/DELETED)');

SELECT expect_accept($$
    INSERT INTO transactions (created_by_user_id, from_account_id, category_id, type, amount, currency, transaction_date)
    VALUES ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001',
            'c0000001-0000-0000-0000-000000000001', 'EXPENSE', 1000, 'VND', NOW())
$$, 'transactions: a new row with no status is ACTIVE by default');

DO $$
BEGIN
    IF (SELECT column_default FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'status') <> '''ACTIVE''::character varying' THEN
        RAISE EXCEPTION 'FAIL  transactions.status must default to ACTIVE';
    END IF;
    RAISE NOTICE 'PASS  transactions.status defaults to ACTIVE';
END $$;

SELECT expect_violation($$
    UPDATE budgets SET amount = 0 WHERE id = (SELECT id FROM budgets ORDER BY id LIMIT 1)
$$, 'chk_budget_amount', 'budgets: a zero amount');

SELECT expect_violation($$
    UPDATE budgets SET currency = 'vnd' WHERE id = (SELECT id FROM budgets ORDER BY id LIMIT 1)
$$, 'chk_budget_currency', 'budgets: a lowercase currency code');

SELECT expect_violation($$
    UPDATE goals SET currency = 'vnd' WHERE id = '40000001-0000-0000-0000-000000000001'
$$, 'chk_goal_currency', 'goals: a lowercase currency code');

SELECT expect_violation($$
    UPDATE goals SET status = 'PAUSED' WHERE id = '40000001-0000-0000-0000-000000000001'
$$, 'chk_goal_status', 'goals: a status outside ACTIVE/COMPLETED/CANCELLED');

SELECT expect_violation($$
    UPDATE goal_contributions SET amount = 0 WHERE id = (SELECT id FROM goal_contributions ORDER BY id LIMIT 1)
$$, 'chk_goal_contribution_amount', 'goal_contributions: a zero amount');

SELECT expect_violation($$
    UPDATE goal_contributions SET currency = 'vnd' WHERE id = (SELECT id FROM goal_contributions ORDER BY id LIMIT 1)
$$, 'chk_goal_contribution_currency', 'goal_contributions: a lowercase currency code');

SELECT expect_violation($$
    INSERT INTO audit_logs (actor_id, wallet_id, event, entity_type, result)
    VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PROBE', 'wallet', 'MAYBE')
$$, 'chk_audit_result', 'audit_logs: a result outside SUCCESS/DENIED/FAILURE');

SELECT expect_violation($$
    INSERT INTO exchange_rate_snapshots (snapshot_date, base_currency, rates, fetched_at) VALUES
        ('2026-01-01', 'USD', '{}'::jsonb, NOW()),
        ('2026-01-01', 'USD', '{}'::jsonb, NOW())
$$, 'uq_exchange_rate_snapshot_date_currency', 'exchange_rate_snapshots: two rows for one date and base currency');

-- ---------------------------------------------------------------------------
-- goal_contributions: never removed
-- ---------------------------------------------------------------------------

SELECT expect_violation($$
    DELETE FROM goal_contributions WHERE id = (SELECT id FROM goal_contributions ORDER BY id LIMIT 1)
$$, 'trg_goal_contribution_kept', 'goal_contributions: deleting a contribution');

SELECT expect_violation($$
    DELETE FROM goals WHERE id = (SELECT goal_id FROM goal_contributions ORDER BY id LIMIT 1)
$$, 'trg_goal_contribution_kept', 'goal_contributions: a goal delete cascading into its contributions');

ROLLBACK;

\echo ''
\echo 'All constraint probes passed.'
