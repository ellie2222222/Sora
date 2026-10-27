-- 007_email_verifications.sql
--
-- The one open emailed code a password account can use to prove it owns its address (API §5.8–5.9):
-- the invitations inbox serves only a verified email (BR-08). One row per user, replaced on every
-- send and removed once the code is used. Only a keyed hash of the code is stored, so a database
-- read cannot verify anyone. `email` is the address the code went to: a code proves that address
-- only, not whatever the account is called later.

BEGIN;

CREATE TABLE email_verifications (
    user_id     UUID         PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email       VARCHAR(255) NOT NULL,
    code_hash   CHAR(64)     NOT NULL,
    attempts    SMALLINT     NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ  NOT NULL,
    sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_email_verification_attempts CHECK (attempts BETWEEN 0 AND 5),
    CONSTRAINT chk_email_verification_expiry CHECK (expires_at > sent_at),
    CONSTRAINT chk_email_verification_hash CHECK (code_hash ~ '^[0-9a-f]{64}$')
);

COMMIT;
