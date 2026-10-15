-- 003_idempotency_keys.sql
--
-- Proves idempotency_keys holds one claim per user and key, never an empty key, and never a
-- response on an attempt that has not completed. Each rejection is checked against the named
-- constraint, so a probe can't pass on an unrelated error (a typo, a missing foreign key).
--
--   psql -d <db> -v ON_ERROR_STOP=1 -f db/tests/003_idempotency_keys.sql
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
    ('73333333-3333-3333-3333-333333333331', 'idem-probe-a@example.invalid', 'x', 'Probe A', 'VND'),
    ('73333333-3333-3333-3333-333333333332', 'idem-probe-b@example.invalid', 'x', 'Probe B', 'VND');

SELECT expect_accept($$
    INSERT INTO idempotency_keys (user_id, idempotency_key, fingerprint)
    VALUES ('73333333-3333-3333-3333-333333333331', 'key-1', repeat('a', 64))
$$, 'idempotency_keys: a fresh claim');

SELECT expect_violation($$
    INSERT INTO idempotency_keys (user_id, idempotency_key, fingerprint)
    VALUES ('73333333-3333-3333-3333-333333333331', 'key-1', repeat('b', 64))
$$, 'uq_idempotency_key', 'idempotency_keys: a second claim of one user''s key');

SELECT expect_accept($$
    INSERT INTO idempotency_keys (user_id, idempotency_key, fingerprint)
    VALUES ('73333333-3333-3333-3333-333333333332', 'key-1', repeat('a', 64))
$$, 'idempotency_keys: the same key for another user');

SELECT expect_violation($$
    INSERT INTO idempotency_keys (user_id, idempotency_key, fingerprint)
    VALUES ('73333333-3333-3333-3333-333333333331', '', repeat('a', 64))
$$, 'chk_idempotency_key_not_empty', 'idempotency_keys: an empty key');

SELECT expect_violation($$
    INSERT INTO idempotency_keys (user_id, idempotency_key, fingerprint, response)
    VALUES ('73333333-3333-3333-3333-333333333331', 'key-2', repeat('a', 64), '{}'::jsonb)
$$, 'chk_idempotency_key_completed', 'idempotency_keys: a response on an attempt still running');

SELECT expect_accept($$
    INSERT INTO idempotency_keys (user_id, idempotency_key, fingerprint, response, completed_at)
    VALUES ('73333333-3333-3333-3333-333333333331', 'key-3', repeat('a', 64), 'null'::jsonb, NOW())
$$, 'idempotency_keys: a completed attempt whose response had no body');

ROLLBACK;

\echo ''
\echo 'All idempotency key probes passed.'
