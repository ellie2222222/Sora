-- 001_initial_wallet_schema.sql
--
-- Wallet-model finance tracker: initial schema.
--
-- Wallet is a *person's* finances (owner_user_id -> users). Account is where that
-- person's money sits. wallet_members grants other real users a role on a wallet,
-- which is what makes "track my partner's/family's wallet" possible.
--
-- There is deliberately no workspace layer: a wallet IS the sharing boundary.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    password_hash   TEXT         NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    base_currency   CHAR(3)      NOT NULL,
    email_verified_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_user_currency CHECK (base_currency ~ '^[A-Z]{3}$')
);

-- Case-insensitive uniqueness: signup with Foo@x.com must collide with foo@x.com.
CREATE UNIQUE INDEX uq_users_email ON users (LOWER(email));

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
-- ---------------------------------------------------------------------------

CREATE TABLE wallets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID         NOT NULL REFERENCES users(id),
    name          VARCHAR(100) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_wallet_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
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

-- A credit card legitimately runs negative, so initial_balance is not
-- CHECK (>= 0) the way the design doc's first draft had it.

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id  UUID         NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    parent_id  UUID         REFERENCES categories(id),
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(20)  NOT NULL,
    icon       VARCHAR(50),
    color      VARCHAR(20),
    status     VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_category_type CHECK (type IN ('INCOME', 'EXPENSE')),
    CONSTRAINT chk_category_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT chk_category_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX idx_categories_wallet ON categories (wallet_id);
CREATE INDEX idx_categories_parent ON categories (parent_id);

CREATE UNIQUE INDEX uq_category_name_per_parent
    ON categories (wallet_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name));

-- ---------------------------------------------------------------------------
-- transactions
--
-- Hangs off accounts, so a transaction's wallet is derived, not stored -- a
-- cross-wallet transfer belongs to two wallets and a single wallet_id column
-- could only name one of them.
-- ---------------------------------------------------------------------------

CREATE TABLE transactions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_user_id UUID           NOT NULL REFERENCES users(id),

    from_account_id    UUID           REFERENCES accounts(id),
    to_account_id      UUID           REFERENCES accounts(id),
    category_id        UUID           REFERENCES categories(id),

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
        CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),

    -- Shape per type, including "a transfer needs two distinct accounts" and
    -- "a transfer carries no category".
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
            AND from_account_id <> to_account_id
            AND category_id IS NULL)
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

-- Budget "spent" scans completed expenses for a category over a date window.
CREATE INDEX idx_transactions_budget_scan
    ON transactions (category_id, transaction_date)
    WHERE type = 'EXPENSE' AND status = 'COMPLETED';

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------

CREATE TABLE budgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id   UUID           NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    category_id UUID           NOT NULL REFERENCES categories(id),

    name        VARCHAR(100)   NOT NULL,
    amount      DECIMAL(19, 4) NOT NULL,
    currency    CHAR(3)        NOT NULL,

    period_type VARCHAR(20)    NOT NULL,
    start_date  DATE           NOT NULL,
    end_date    DATE           NOT NULL,

    status      VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE',

    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_budget_amount CHECK (amount > 0),
    CONSTRAINT chk_budget_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_budget_period
        CHECK (period_type IN ('WEEKLY', 'MONTHLY', 'CUSTOM')),
    CONSTRAINT chk_budget_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_budget_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE INDEX idx_budgets_wallet_period ON budgets (wallet_id, start_date, end_date);
CREATE INDEX idx_budgets_category ON budgets (category_id);

-- One active budget per category per overlapping window. GIST over a daterange
-- is what actually rejects an overlap; a plain unique index cannot express it.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

ALTER TABLE budgets
    ADD CONSTRAINT excl_budget_overlap
    EXCLUDE USING GIST (
        category_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (status = 'ACTIVE');

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

COMMIT;
