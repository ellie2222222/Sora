-- 001_schema.sql
--
-- Wallet-model finance tracker: the whole schema. A later schema change is a new,
-- numbered file after this one; scripts/migrate.mjs applies them in order.
--
-- Wallet is a *person's* finances (owner_user_id -> users). Account is where that
-- person's money sits. wallet_members grants other real users a role on a wallet,
-- which is what makes "track my partner's/family's wallet" possible.
--
-- There is deliberately no workspace layer: a wallet IS the sharing boundary.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Lets the budget overlap exclusions mix a UUID equality with a daterange overlap in one GIST index.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ---------------------------------------------------------------------------
-- users
--
-- A Google-only user never sets a password, so password_hash is nullable -- but a
-- row with neither a password nor a Google identity could never authenticate
-- through any path, which is what chk_user_has_credential rules out.
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             VARCHAR(255) NOT NULL,
    password_hash     TEXT,
    google_id         TEXT,
    display_name      VARCHAR(100) NOT NULL,
    base_currency     CHAR(3)      NOT NULL,
    theme             VARCHAR(20)  NOT NULL DEFAULT 'obsidian',
    locale            VARCHAR(10)  NOT NULL DEFAULT 'en',
    email_verified_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_user_currency CHECK (base_currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_user_has_credential
        CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL),
    CONSTRAINT chk_user_theme
        CHECK (theme IN ('obsidian', 'quartz', 'sage', 'terracotta', 'violet')),
    CONSTRAINT chk_user_locale
        CHECK (locale IN ('en', 'vi'))
);

-- Case-insensitive uniqueness: signup with Foo@x.com must collide with foo@x.com.
CREATE UNIQUE INDEX uq_users_email ON users (LOWER(email));
CREATE UNIQUE INDEX uq_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- refresh_tokens
--
-- Only the hash is stored, so a database read cannot mint a session.
-- ---------------------------------------------------------------------------

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- wallets
--
-- time_zone is the IANA zone the wallet's calendar is read in: which day and month
-- a transaction instant belongs to, and what "today" is, for every member alike.
-- Instants stay TIMESTAMPTZ; nothing stores a derived local date.
-- ---------------------------------------------------------------------------

-- STABLE, not IMMUTABLE: the answer follows the server's tz database. Case-insensitive, as both
-- Postgres and Intl resolve zone names.
CREATE OR REPLACE FUNCTION is_iana_time_zone(zone TEXT) RETURNS BOOLEAN
    LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE LOWER(name) = LOWER(zone)) $$;

CREATE TABLE wallets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID         NOT NULL REFERENCES users(id),
    name          VARCHAR(100) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    time_zone     VARCHAR(64)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_wallet_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT chk_wallet_time_zone CHECK (is_iana_time_zone(time_zone))
);

CREATE INDEX idx_wallets_owner ON wallets (owner_user_id);

-- ---------------------------------------------------------------------------
-- wallet_members
--
-- One row per user who may act on a wallet, the owner included. Invitations that
-- have not been accepted live in wallet_invitations, not here -- an invite is
-- addressed to an email that may not have a users row yet, so a PENDING member
-- row would need a NULL user_id and lose the FK that every access check reads.
-- ---------------------------------------------------------------------------

CREATE TABLE wallet_members (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id      UUID        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role           VARCHAR(20) NOT NULL,
    relation_label VARCHAR(50),
    status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wallet_member UNIQUE (wallet_id, user_id),
    CONSTRAINT chk_wallet_member_role
        CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
    CONSTRAINT chk_wallet_member_status
        CHECK (status IN ('ACTIVE', 'REVOKED'))
);

CREATE INDEX idx_wallet_members_wallet ON wallet_members (wallet_id);
CREATE INDEX idx_wallet_members_user   ON wallet_members (user_id);

-- A wallet has exactly one active owner. Enforced here rather than in the
-- service layer because "the last owner left and nobody can administer this
-- wallet" is unrecoverable through the API.
CREATE UNIQUE INDEX uq_wallet_single_owner
    ON wallet_members (wallet_id)
    WHERE role = 'OWNER' AND status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- wallet_invitations
--
-- Single-use, expiring, addressed to an email. Only the token hash is stored.
-- ---------------------------------------------------------------------------

CREATE TABLE wallet_invitations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id          UUID         NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    invited_email      VARCHAR(255) NOT NULL,
    role               VARCHAR(20)  NOT NULL,
    relation_label     VARCHAR(50),
    token_hash         TEXT         NOT NULL UNIQUE,
    expires_at         TIMESTAMPTZ  NOT NULL,
    accepted_at        TIMESTAMPTZ,
    revoked_at         TIMESTAMPTZ,
    created_by_user_id UUID         NOT NULL REFERENCES users(id),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_invitation_role
        CHECK (role IN ('EDITOR', 'VIEWER'))
);

CREATE INDEX idx_wallet_invitations_wallet ON wallet_invitations (wallet_id);
CREATE INDEX idx_wallet_invitations_email  ON wallet_invitations (LOWER(invited_email));

-- At most one live invitation per (wallet, email) -- re-inviting must revoke or
-- reuse, not stack up tokens that all still work.
CREATE UNIQUE INDEX uq_wallet_invitation_open
    ON wallet_invitations (wallet_id, LOWER(invited_email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- accounts
--
-- A credit card legitimately runs negative, so initial_balance has no >= 0 check.
-- ---------------------------------------------------------------------------

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID           NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    name            VARCHAR(100)   NOT NULL,
    type            VARCHAR(30)    NOT NULL,
    currency        CHAR(3)        NOT NULL,
    initial_balance DECIMAL(19, 4) NOT NULL DEFAULT 0,
    status          VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_account_type
        CHECK (type IN ('BANK_ACCOUNT', 'CASH', 'E_WALLET', 'CREDIT_CARD')),
    CONSTRAINT chk_account_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_account_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE INDEX idx_accounts_wallet ON accounts (wallet_id);

-- ---------------------------------------------------------------------------
-- categories
--
-- Matching a category's type to its transaction's type is a service check, not a
-- constraint: a CHECK cannot read another table.
--
-- system_key marks a starter category: its name is read from category_translations
-- in the viewer's locale, and name holds the English fallback. NULL is a custom
-- category, shown exactly as typed; renaming a starter category clears the key.
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id  UUID         NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    parent_id  UUID         REFERENCES categories(id),
    system_key VARCHAR(50),
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(20)  NOT NULL,
    icon       VARCHAR(50),
    color      VARCHAR(20),
    status     VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_category_type CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    CONSTRAINT chk_category_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT chk_category_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX idx_categories_wallet ON categories (wallet_id);
CREATE INDEX idx_categories_parent ON categories (parent_id);

CREATE UNIQUE INDEX uq_category_name_per_parent
    ON categories (wallet_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name));

-- One copy of each starter category per wallet, so a re-run seed or backfill cannot duplicate one.
CREATE UNIQUE INDEX uq_category_system_key
    ON categories (wallet_id, system_key) WHERE system_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- category_translations
--
-- Keyed by system_key rather than by category id: every wallet holds its own copy of
-- the starter categories, and one row per key and locale serves all of them. Mirrors
-- STARTER_CATEGORIES in packages/contracts (check-contract-parity.mjs compares them).
-- ---------------------------------------------------------------------------

CREATE TABLE category_translations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_key  VARCHAR(50)  NOT NULL,
    locale      VARCHAR(10)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,

    CONSTRAINT uq_category_translation UNIQUE (system_key, locale),
    CONSTRAINT chk_category_translation_locale CHECK (locale IN ('en', 'vi'))
);

INSERT INTO category_translations (system_key, locale, name) VALUES
    ('food', 'en', 'Food'),
    ('food', 'vi', 'Ăn uống'),
    ('transportation', 'en', 'Transportation'),
    ('transportation', 'vi', 'Đi lại'),
    ('shopping', 'en', 'Shopping'),
    ('shopping', 'vi', 'Mua sắm'),
    ('bills', 'en', 'Bills'),
    ('bills', 'vi', 'Hóa đơn'),
    ('housing', 'en', 'Housing'),
    ('housing', 'vi', 'Nhà ở'),
    ('groceries', 'en', 'Groceries'),
    ('groceries', 'vi', 'Đi chợ'),
    ('health', 'en', 'Health'),
    ('health', 'vi', 'Sức khỏe'),
    ('entertainment', 'en', 'Entertainment'),
    ('entertainment', 'vi', 'Giải trí'),
    ('education', 'en', 'Education'),
    ('education', 'vi', 'Giáo dục'),
    ('travel', 'en', 'Travel'),
    ('travel', 'vi', 'Du lịch'),
    ('subscriptions', 'en', 'Subscriptions'),
    ('subscriptions', 'vi', 'Gói đăng ký'),
    ('insurance', 'en', 'Insurance'),
    ('insurance', 'vi', 'Bảo hiểm'),
    ('dining_out', 'en', 'Dining Out'),
    ('dining_out', 'vi', 'Ăn ngoài'),
    ('utilities', 'en', 'Utilities'),
    ('utilities', 'vi', 'Điện nước'),
    ('personal_care', 'en', 'Personal Care'),
    ('personal_care', 'vi', 'Chăm sóc cá nhân'),
    ('fitness', 'en', 'Fitness'),
    ('fitness', 'vi', 'Thể thao'),
    ('pets', 'en', 'Pets'),
    ('pets', 'vi', 'Thú cưng'),
    ('repairs_maintenance', 'en', 'Repairs & Maintenance'),
    ('repairs_maintenance', 'vi', 'Sửa chữa & bảo dưỡng'),
    ('movies', 'en', 'Movies'),
    ('movies', 'vi', 'Xem phim'),
    ('snacks', 'en', 'Snacks'),
    ('snacks', 'vi', 'Ăn vặt'),
    ('drinks', 'en', 'Drinks'),
    ('drinks', 'vi', 'Đồ uống'),
    ('fees', 'en', 'Fees'),
    ('fees', 'vi', 'Phí'),
    ('other_expense', 'en', 'Other Expense'),
    ('other_expense', 'vi', 'Chi khác'),
    ('salary', 'en', 'Salary'),
    ('salary', 'vi', 'Lương'),
    ('freelance', 'en', 'Freelance'),
    ('freelance', 'vi', 'Làm tự do'),
    ('investment', 'en', 'Investment'),
    ('investment', 'vi', 'Đầu tư'),
    ('gift', 'en', 'Gift'),
    ('gift', 'vi', 'Quà tặng'),
    ('rental_income', 'en', 'Rental Income'),
    ('rental_income', 'vi', 'Cho thuê'),
    ('interest', 'en', 'Interest'),
    ('interest', 'vi', 'Tiền lãi'),
    ('bonus', 'en', 'Bonus'),
    ('bonus', 'vi', 'Thưởng'),
    ('refund', 'en', 'Refund'),
    ('refund', 'vi', 'Hoàn tiền'),
    ('part_time', 'en', 'Part Time'),
    ('part_time', 'vi', 'Làm thêm'),
    ('other_income', 'en', 'Other Income'),
    ('other_income', 'vi', 'Thu khác'),
    ('savings', 'en', 'Savings'),
    ('savings', 'vi', 'Tiết kiệm'),
    ('debt_repayment', 'en', 'Debt Repayment'),
    ('debt_repayment', 'vi', 'Trả nợ'),
    ('credit_card_payment', 'en', 'Credit Card Payment'),
    ('credit_card_payment', 'vi', 'Thanh toán thẻ tín dụng'),
    ('top_up', 'en', 'Top Up'),
    ('top_up', 'vi', 'Nạp tiền'),
    ('cash_withdrawal', 'en', 'Cash Withdrawal'),
    ('cash_withdrawal', 'vi', 'Rút tiền mặt');

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------

CREATE TABLE goals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id     UUID           NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,

    name          VARCHAR(150)   NOT NULL,
    description   VARCHAR(500),

    target_amount DECIMAL(19, 4) NOT NULL,
    currency      CHAR(3)        NOT NULL,
    target_date   DATE,

    status        VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE',

    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_goal_target CHECK (target_amount > 0),
    CONSTRAINT chk_goal_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_goal_status
        CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX idx_goals_wallet_status ON goals (wallet_id, status);

-- ---------------------------------------------------------------------------
-- transactions
--
-- Hangs off accounts, so a transaction's wallet is derived, not stored -- a
-- cross-wallet transfer belongs to two wallets and a single wallet_id column
-- could only name one of them. A deleted transaction keeps its row with status
-- DELETED; only COMPLETED ones count toward any derived figure.
-- ---------------------------------------------------------------------------

CREATE TABLE transactions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_user_id UUID           NOT NULL REFERENCES users(id),

    from_account_id    UUID           REFERENCES accounts(id),
    to_account_id      UUID           REFERENCES accounts(id),
    category_id        UUID           REFERENCES categories(id),
    goal_id            UUID           REFERENCES goals(id) ON DELETE SET NULL,

    type               VARCHAR(20)    NOT NULL,
    amount             DECIMAL(19, 4) NOT NULL,
    currency           CHAR(3)        NOT NULL,

    description        VARCHAR(500),
    transaction_date   TIMESTAMPTZ    NOT NULL,

    status             VARCHAR(20)    NOT NULL DEFAULT 'COMPLETED',
    reference          VARCHAR(100),

    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_transaction_type
        CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    CONSTRAINT chk_transaction_amount CHECK (amount > 0),
    CONSTRAINT chk_transaction_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_transaction_status
        CHECK (status IN ('PENDING', 'COMPLETED', 'DELETED')),
    -- Only an expense carries a goal tag.
    CONSTRAINT chk_transaction_goal CHECK (goal_id IS NULL OR type = 'EXPENSE'),

    -- Shape per type, including "a transfer needs two distinct accounts". A transfer's
    -- category ("Savings") is optional; it still never counts as income or expense (BR-06).
    CONSTRAINT chk_transaction_shape CHECK (
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
    )
);

CREATE INDEX idx_transactions_from_account
    ON transactions (from_account_id, transaction_date DESC);
CREATE INDEX idx_transactions_to_account
    ON transactions (to_account_id, transaction_date DESC);
CREATE INDEX idx_transactions_category_date
    ON transactions (category_id, transaction_date DESC);
CREATE INDEX idx_transactions_creator_date
    ON transactions (created_by_user_id, transaction_date DESC);
CREATE INDEX idx_transactions_goal ON transactions (goal_id);

-- Budget "spent" scans completed expenses for a category over a date window.
CREATE INDEX idx_transactions_budget_scan
    ON transactions (category_id, transaction_date)
    WHERE type = 'EXPENSE' AND status = 'COMPLETED';

-- ---------------------------------------------------------------------------
-- budgets
--
-- Exactly one kind: a category budget (category set, any period but GOAL), a goal
-- budget (goal set, period GOAL) or a wallet-wide budget (neither). A DAILY/WEEKLY/
-- MONTHLY/YEARLY budget repeats from start_date until it is deleted, so it has no
-- end_date; CUSTOM and GOAL cover a fixed window. Budgets are deleted outright.
-- ---------------------------------------------------------------------------

CREATE TABLE budgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id   UUID           NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    category_id UUID           REFERENCES categories(id),
    goal_id     UUID           REFERENCES goals(id) ON DELETE CASCADE,

    name        VARCHAR(100)   NOT NULL,
    amount      DECIMAL(19, 4) NOT NULL,
    currency    CHAR(3)        NOT NULL,

    period_type VARCHAR(20)    NOT NULL,
    start_date  DATE           NOT NULL,
    end_date    DATE,

    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_budget_amount CHECK (amount > 0),
    CONSTRAINT chk_budget_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_budget_period
        CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM', 'GOAL')),
    CONSTRAINT chk_budget_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_budget_end
        CHECK ((period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')) = (end_date IS NULL)),
    CONSTRAINT chk_budget_kind CHECK (
        (category_id IS NULL OR goal_id IS NULL)
        AND ((period_type = 'GOAL') = (goal_id IS NOT NULL))
    )
);

CREATE INDEX idx_budgets_wallet_period ON budgets (wallet_id, start_date, end_date);
CREATE INDEX idx_budgets_category ON budgets (category_id);

-- At most one budget per target over overlapping days. GIST over a daterange is what
-- actually rejects an overlap; a plain unique index cannot express it. An open
-- end_date is an unbounded range, so a repeating budget holds its target until deleted.
ALTER TABLE budgets
    ADD CONSTRAINT excl_budget_category_overlap
    EXCLUDE USING GIST (
        category_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (category_id IS NOT NULL);

ALTER TABLE budgets
    ADD CONSTRAINT excl_budget_goal_overlap
    EXCLUDE USING GIST (
        goal_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (goal_id IS NOT NULL);

ALTER TABLE budgets
    ADD CONSTRAINT excl_budget_overall_overlap
    EXCLUDE USING GIST (
        wallet_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (category_id IS NULL AND goal_id IS NULL);

-- ---------------------------------------------------------------------------
-- goal_contributions
-- ---------------------------------------------------------------------------

CREATE TABLE goal_contributions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    goal_id           UUID           NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    account_id        UUID           NOT NULL REFERENCES accounts(id),
    transaction_id    UUID           UNIQUE REFERENCES transactions(id),

    amount            DECIMAL(19, 4) NOT NULL,
    currency          CHAR(3)        NOT NULL,

    contribution_date TIMESTAMPTZ    NOT NULL,
    note              VARCHAR(500),

    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_goal_contribution_amount CHECK (amount > 0),
    CONSTRAINT chk_goal_contribution_currency CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX idx_goal_contributions_goal_date
    ON goal_contributions (goal_id, contribution_date DESC);
CREATE INDEX idx_goal_contributions_account ON goal_contributions (account_id);

-- ---------------------------------------------------------------------------
-- audit_logs
--
-- Financial mutations and every role/membership change are recorded. Kept
-- append-only by convention: the API exposes no update or delete path.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID        REFERENCES users(id),
    wallet_id   UUID        REFERENCES wallets(id) ON DELETE SET NULL,
    event       VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id   VARCHAR(64),
    result      VARCHAR(20) NOT NULL,
    actor_role  VARCHAR(20),
    note        VARCHAR(500),
    ip          VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_audit_result CHECK (result IN ('SUCCESS', 'DENIED', 'FAILURE'))
);

CREATE INDEX idx_audit_logs_wallet_date ON audit_logs (wallet_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_date  ON audit_logs (actor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- exchange_rate_snapshots
--
-- Daily rate history: reproducible historical valuation, and a stale-rate
-- fallback when the external provider is unreachable (BR-07's display total).
-- ---------------------------------------------------------------------------

CREATE TABLE exchange_rate_snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE        NOT NULL,
    base_currency VARCHAR(3)  NOT NULL,
    rates         JSONB       NOT NULL,
    source        VARCHAR(50) NOT NULL DEFAULT 'open.er-api.com',
    fetched_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_exchange_rate_snapshot_date_currency UNIQUE (snapshot_date, base_currency)
);

CREATE INDEX idx_exchange_rate_snapshots_lookup
    ON exchange_rate_snapshots (base_currency, snapshot_date DESC);

-- ---------------------------------------------------------------------------
-- ai_conversations, ai_messages
--
-- The AI assistant's chat history. A conversation belongs to one user and is read
-- in the context of one wallet at a time. An assistant message may carry a proposed
-- action (a transaction draft), which only the user's explicit confirmation turns
-- into a real transaction; the assistant never writes the ledger itself.
-- ---------------------------------------------------------------------------

CREATE TABLE ai_conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id   UUID         REFERENCES wallets(id),
    title       VARCHAR(150) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ai_conversation_title CHECK (length(btrim(title)) > 0)
);

CREATE INDEX idx_ai_conversations_user
    ON ai_conversations (user_id, updated_at DESC);

CREATE TABLE ai_messages (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id        UUID        NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role                   VARCHAR(20) NOT NULL,
    content                TEXT        NOT NULL,
    action_type            VARCHAR(40),
    action_payload         JSONB,
    action_status          VARCHAR(20),
    action_transaction_id  UUID        REFERENCES transactions(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ai_message_role
        CHECK (role IN ('USER', 'ASSISTANT')),
    CONSTRAINT chk_ai_message_content CHECK (length(content) BETWEEN 1 AND 8000),
    CONSTRAINT chk_ai_message_action_type
        CHECK (action_type IN ('CREATE_TRANSACTION')),
    CONSTRAINT chk_ai_message_action_status
        CHECK (action_status IN ('PENDING', 'CONFIRMED', 'DISMISSED')),
    -- An action is all-or-nothing, only the assistant proposes one, and a
    -- confirmed action names the transaction it recorded (and nothing else does).
    CONSTRAINT chk_ai_message_action_shape CHECK (
        (action_type IS NULL) = (action_payload IS NULL)
        AND (action_type IS NULL) = (action_status IS NULL)
        AND (action_type IS NULL OR role = 'ASSISTANT')
        AND (COALESCE(action_status, '') = 'CONFIRMED') = (action_transaction_id IS NOT NULL)
    )
);

CREATE INDEX idx_ai_messages_conversation
    ON ai_messages (conversation_id, created_at, id);

COMMIT;
