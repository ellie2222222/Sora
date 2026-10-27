-- 005_email_verifications.sql
--
-- Proves an emailed verification code stays bounded: at most 5 guesses, an expiry after it was sent,
-- only a hex digest stored, one open code per user, and at most 5 sends in a day's window. Each
-- rejection is checked against the named constraint, so a probe can't pass on an unrelated error.
--
--   psql -d <db> -v ON_ERROR_STOP=1 -f db/tests/005_email_verifications.sql
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
    ('75555555-5555-4555-8555-555555555551', 'verify-probe@example.invalid', 'x', 'Verify Probe', 'VND');

SELECT expect_accept($$
    INSERT INTO email_verifications (user_id, email, code_hash, expires_at)
    VALUES ('75555555-5555-4555-8555-555555555551', 'verify-probe@example.invalid', repeat('a1', 32), NOW() + INTERVAL '15 minutes')
$$, 'email_verifications: an open code');

SELECT expect_violation($$
    INSERT INTO email_verifications (user_id, email, code_hash, expires_at)
    VALUES ('75555555-5555-4555-8555-555555555551', 'verify-probe@example.invalid', repeat('b2', 32), NOW() + INTERVAL '15 minutes')
$$, 'email_verifications_pkey', 'email_verifications: a second open code for the same user');

SELECT expect_violation($$
    UPDATE email_verifications SET attempts = 6 WHERE user_id = '75555555-5555-4555-8555-555555555551'
$$, 'chk_email_verification_attempts', 'email_verifications: a sixth guess');

SELECT expect_violation($$
    UPDATE email_verifications SET expires_at = sent_at WHERE user_id = '75555555-5555-4555-8555-555555555551'
$$, 'chk_email_verification_expiry', 'email_verifications: expiring the moment it was sent');

SELECT expect_violation($$
    UPDATE email_verifications SET code_hash = rpad('123456', 64, ' ') WHERE user_id = '75555555-5555-4555-8555-555555555551'
$$, 'chk_email_verification_hash', 'email_verifications: the plain code instead of its digest');

SELECT expect_accept($$
    UPDATE email_verifications SET sends_in_window = 5 WHERE user_id = '75555555-5555-4555-8555-555555555551'
$$, 'email_verifications: the fifth send in a day');

SELECT expect_violation($$
    UPDATE email_verifications SET sends_in_window = 6 WHERE user_id = '75555555-5555-4555-8555-555555555551'
$$, 'chk_email_verification_sends', 'email_verifications: a sixth send in a day');

SELECT expect_violation($$
    UPDATE email_verifications SET window_started_at = sent_at + INTERVAL '1 second' WHERE user_id = '75555555-5555-4555-8555-555555555551'
$$, 'chk_email_verification_window', 'email_verifications: a send window opening after the send');

ROLLBACK;
