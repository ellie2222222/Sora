-- 002_google_auth_and_preferences.sql
--
-- Google sign-in and persisted theme/locale preferences.
--
-- A Google-only user never sets a password, so password_hash must become
-- nullable -- but a row with neither a password nor a Google identity could
-- never authenticate through any path, which is why chk_user_has_credential
-- exists rather than leaving both columns independently optional.

BEGIN;

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL,
    ADD COLUMN google_id TEXT,
    ADD COLUMN theme      VARCHAR(20) NOT NULL DEFAULT 'obsidian',
    ADD COLUMN locale     VARCHAR(10) NOT NULL DEFAULT 'en';

CREATE UNIQUE INDEX uq_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

ALTER TABLE users
    ADD CONSTRAINT chk_user_has_credential
        CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL),
    ADD CONSTRAINT chk_user_theme
        CHECK (theme IN ('obsidian', 'quartz', 'sage', 'terracotta', 'violet')),
    ADD CONSTRAINT chk_user_locale
        CHECK (locale IN ('en', 'vi'));

COMMIT;
