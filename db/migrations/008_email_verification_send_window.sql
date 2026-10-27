-- 008_email_verification_send_window.sql
--
-- Caps how many codes one account can have mailed in a day (API §5.8), on top of the one-a-minute
-- resend wait: the per-IP limit alone lets a signed-in caller on rotating addresses flood the
-- inbox the account names. The window opens at the first send and counts sends until a day later.

BEGIN;

ALTER TABLE email_verifications
    ADD COLUMN window_started_at TIMESTAMPTZ,
    ADD COLUMN sends_in_window   SMALLINT NOT NULL DEFAULT 1;

UPDATE email_verifications SET window_started_at = sent_at;

ALTER TABLE email_verifications
    ALTER COLUMN window_started_at SET NOT NULL,
    ALTER COLUMN window_started_at SET DEFAULT NOW(),
    ADD CONSTRAINT chk_email_verification_sends CHECK (sends_in_window BETWEEN 1 AND 5),
    ADD CONSTRAINT chk_email_verification_window CHECK (window_started_at <= sent_at);

COMMIT;
