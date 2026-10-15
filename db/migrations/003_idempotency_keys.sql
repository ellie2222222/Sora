-- 003_idempotency_keys.sql
--
-- Idempotency-Key records (API spec §2.10), kept in the database so a retried write is recognised
-- after an API restart or by another API process, not only by the process that saw the first
-- attempt. One row per user and key: claimed when the first attempt starts, completed with the
-- response it gave. Rows past the 24-hour retention are purged by the API; nothing derived reads them.

BEGIN;

CREATE TABLE idempotency_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL,
    -- SHA-256 of method, path and body: the same key on a different request is refused, not replayed.
    fingerprint     CHAR(64)     NOT NULL,
    response        JSONB,
    completed_at    TIMESTAMPTZ,
    -- When the attempt holding the claim started; a claim untouched for long belongs to one that died.
    claimed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_idempotency_key UNIQUE (user_id, idempotency_key),
    CONSTRAINT chk_idempotency_key_not_empty CHECK (idempotency_key <> ''),
    CONSTRAINT chk_idempotency_key_completed CHECK (completed_at IS NOT NULL OR response IS NULL)
);

CREATE INDEX idx_idempotency_keys_created ON idempotency_keys (created_at);

COMMIT;
