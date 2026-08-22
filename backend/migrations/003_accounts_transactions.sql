-- 003: Accounts and transactions (ACC-US-01…03, TXN-US-01…05, CAT-US-01)
-- Corresponds to SDS §4.3.3.

-- Categories gain the default-flag from the SDS schema.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Category type is INCOME | EXPENSE (uppercase) per SDS §4.3.3.
UPDATE categories SET type = UPPER(type) WHERE type <> UPPER(type);

-- Existing seeded categories are defaults.
UPDATE categories SET is_default = TRUE WHERE is_default = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_per_workspace
  ON categories (workspace_id, LOWER(name)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,           -- CASH, BANK_ACCOUNT, CREDIT_CARD, DEBIT_CARD, SAVINGS, INVESTMENT, CRYPTO, DIGITAL_WALLET
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  institution VARCHAR(255),
  account_number VARCHAR(255),         -- masked
  color VARCHAR(7),
  icon VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL          -- archival (ACC-US-03)
);

CREATE INDEX IF NOT EXISTS idx_accounts_workspace_id ON accounts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at ON accounts (deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_name_per_workspace
  ON accounts (workspace_id, LOWER(name)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  category_id INTEGER NULL REFERENCES categories(id),  -- NULL for TRANSFER legs
  type VARCHAR(50) NOT NULL,           -- INCOME, EXPENSE, TRANSFER, REFUND, INVESTMENT, LOAN, DEBT
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  notes TEXT,
  receipt_url VARCHAR(1024),
  location VARCHAR(255),
  tags TEXT,
  transfer_group_id VARCHAR(36),       -- links the debit/credit pair of one transfer
  created_by INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'recorded',  -- recorded | cancelled
  cancelled_at TIMESTAMPTZ NULL,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_workspace_id ON transactions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions (created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group_id ON transactions (transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON transactions (deleted_at);
