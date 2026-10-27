-- 004_account_card_details.sql
--
-- Proves an account's card details stay what they claim to be: a known network, exactly four
-- digits, a bank name that is not blank, and none of it on an account that has no card. Each
-- rejection is checked against the named constraint, so a probe can't pass on an unrelated error.
--
--   psql -d <db> -v ON_ERROR_STOP=1 -f db/tests/004_account_card_details.sql
--
-- Rolls back, like 001, so its fixed-id seed never persists.

\set ON_ERROR_STOP on
SET client_min_messages = NOTICE;

BEGIN;

CREATE OR REPLACE FUNCTION expect_violation(stmt TEXT, expected TEXT, label TEXT) RETURNS void AS $$
DECLARE
    violated TEXT;
BEGIN
    BEGIN
        EXECUTE stmt;
    EXCEPTION
        WHEN integrity_constraint_violation THEN
            GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
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

INSERT INTO users (id, email, password_hash, display_name, base_currency) VALUES
    ('74444444-4444-4444-4444-444444444441', 'card-probe@example.invalid', 'x', 'Card Probe', 'VND');
INSERT INTO wallets (id, owner_user_id, name, time_zone) VALUES
    ('74444444-4444-4444-4444-4444444444aa', '74444444-4444-4444-4444-444444444441', 'Card Probe Wallet', 'Asia/Ho_Chi_Minh');

SELECT expect_accept($$
    INSERT INTO accounts (wallet_id, name, type, currency, institution_name, card_network, card_last4)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'My Visa', 'CREDIT_CARD', 'VND', 'Vietcombank', 'VISA', '4821')
$$, 'accounts: a credit card with its bank, network and last four');

SELECT expect_accept($$
    INSERT INTO accounts (wallet_id, name, type, currency, institution_name, card_network)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'Salary', 'BANK_ACCOUNT', 'VND', 'Techcombank', 'NAPAS')
$$, 'accounts: a bank account with a NAPAS debit card and no last four');

SELECT expect_accept($$
    INSERT INTO accounts (wallet_id, name, type, currency, institution_name)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'MoMo', 'E_WALLET', 'VND', 'MoMo')
$$, 'accounts: an e-wallet naming its provider');

SELECT expect_accept($$
    INSERT INTO accounts (wallet_id, name, type, currency)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'Pocket', 'CASH', 'VND')
$$, 'accounts: cash with no card details');

SELECT expect_violation($$
    INSERT INTO accounts (wallet_id, name, type, currency, card_network)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'Bad', 'CREDIT_CARD', 'VND', 'DINERS')
$$, 'chk_account_card_network', 'accounts: a network outside the list');

SELECT expect_violation($$
    INSERT INTO accounts (wallet_id, name, type, currency, card_last4)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'Bad', 'CREDIT_CARD', 'VND', '48a1')
$$, 'chk_account_card_last4', 'accounts: last four that are not four digits');

SELECT expect_violation($$
    INSERT INTO accounts (wallet_id, name, type, currency, card_last4)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'Bad', 'CREDIT_CARD', 'VND', '482')
$$, 'chk_account_card_last4', 'accounts: three digits padded to four');

SELECT expect_violation($$
    INSERT INTO accounts (wallet_id, name, type, currency, institution_name)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'Bad', 'BANK_ACCOUNT', 'VND', '   ')
$$, 'chk_account_institution_not_blank', 'accounts: a blank bank name');

SELECT expect_violation($$
    INSERT INTO accounts (wallet_id, name, type, currency, card_network)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'Bad', 'E_WALLET', 'VND', 'VISA')
$$, 'chk_account_card_details_type', 'accounts: an e-wallet with a card network');

SELECT expect_violation($$
    INSERT INTO accounts (wallet_id, name, type, currency, institution_name)
    VALUES ('74444444-4444-4444-4444-4444444444aa', 'Bad', 'CASH', 'VND', 'Vietcombank')
$$, 'chk_account_card_details_type', 'accounts: cash naming a bank');

SELECT expect_violation($$
    UPDATE accounts SET type = 'CASH' WHERE name = 'My Visa'
$$, 'chk_account_card_details_type', 'accounts: a card turned into cash while it still carries card details');

ROLLBACK;
