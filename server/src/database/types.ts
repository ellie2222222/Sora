/**
 * Kysely's view of the schema db/migrations/ builds.
 *
 * Hand-written rather than generated, and deliberately so: the schema's CHECK
 * constraints, partial unique indexes and the GIST exclusion constraint are
 * business rules authored as SQL, and a tool that re-derives DDL from these
 * types would drift from them. The enum unions below are imported from
 * @sora/contracts, which is byte-checked against those CHECK constraints by
 * scripts/check-contract-parity.mjs — so a column type here cannot disagree
 * with the database without that check failing.
 */

import type { ColumnType, Generated } from 'kysely';
import type {
  AccountStatus,
  AccountType,
  BudgetPeriodType,
  BudgetStatus,
  CategoryStatus,
  CategoryType,
  GoalStatus,
  MemberStatus,
  TransactionStatus,
  TransactionType,
  WalletRole,
  WalletStatus,
} from '@sora/contracts';

/** TIMESTAMPTZ. Read as Date; writable as Date or an ISO string. */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

/**
 * DECIMAL(19,4). A string on the way out and in — never a JS number.
 * `configurePgTypeParsers()` is what guarantees the read side.
 */
type Money = ColumnType<string, string, string>;

/** DATE, kept as 'YYYY-MM-DD' so calendar-day comparison needs no timezone. */
type CalendarDate = ColumnType<string, string, string>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  display_name: string;
  base_currency: string;
  theme: Generated<string>;
  locale: Generated<string>;
  email_verified_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  revoked_at: Timestamp | null;
  created_at: Timestamp;
}

export interface WalletsTable {
  id: Generated<string>;
  owner_user_id: string;
  name: string;
  status: Generated<WalletStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface WalletMembersTable {
  id: Generated<string>;
  wallet_id: string;
  user_id: string;
  role: WalletRole;
  relation_label: string | null;
  status: Generated<MemberStatus>;
  joined_at: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface WalletInvitationsTable {
  id: Generated<string>;
  wallet_id: string;
  invited_email: string;
  role: WalletRole;
  relation_label: string | null;
  token_hash: string;
  expires_at: Timestamp;
  accepted_at: Timestamp | null;
  revoked_at: Timestamp | null;
  created_by_user_id: string;
  created_at: Timestamp;
}

export interface AccountsTable {
  id: Generated<string>;
  wallet_id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: Money;
  status: Generated<AccountStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CategoriesTable {
  id: Generated<string>;
  wallet_id: string;
  parent_id: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  status: Generated<CategoryStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TransactionsTable {
  id: Generated<string>;
  created_by_user_id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  type: TransactionType;
  amount: Money;
  currency: string;
  description: string | null;
  transaction_date: Timestamp;
  status: Generated<TransactionStatus>;
  reference: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BudgetsTable {
  id: Generated<string>;
  wallet_id: string;
  category_id: string;
  name: string;
  amount: Money;
  currency: string;
  period_type: BudgetPeriodType;
  start_date: CalendarDate;
  end_date: CalendarDate;
  status: Generated<BudgetStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface GoalsTable {
  id: Generated<string>;
  wallet_id: string;
  name: string;
  description: string | null;
  target_amount: Money;
  currency: string;
  target_date: CalendarDate | null;
  status: Generated<GoalStatus>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface GoalContributionsTable {
  id: Generated<string>;
  goal_id: string;
  account_id: string;
  transaction_id: string | null;
  amount: Money;
  currency: string;
  contribution_date: Timestamp;
  note: string | null;
  created_at: Timestamp;
}

export type AuditResult = 'SUCCESS' | 'DENIED' | 'FAILURE';

export interface AuditLogsTable {
  /** BIGSERIAL, read as a string so a 2^53 overflow cannot silently truncate. */
  id: Generated<string>;
  actor_id: string | null;
  wallet_id: string | null;
  event: string;
  entity_type: string;
  entity_id: string | null;
  result: AuditResult;
  actor_role: string | null;
  note: string | null;
  ip: string | null;
  created_at: Timestamp;
}

export interface ExchangeRateSnapshotsTable {
  id: Generated<string>;
  snapshot_date: CalendarDate;
  base_currency: string;
  rates: ColumnType<Record<string, number>, string | Record<string, number>, string | Record<string, number>>;
  source: string;
  fetched_at: Timestamp;
  created_at: Timestamp;
}

export interface DB {
  users: UsersTable;
  refresh_tokens: RefreshTokensTable;
  wallets: WalletsTable;
  wallet_members: WalletMembersTable;
  wallet_invitations: WalletInvitationsTable;
  accounts: AccountsTable;
  categories: CategoriesTable;
  transactions: TransactionsTable;
  budgets: BudgetsTable;
  goals: GoalsTable;
  goal_contributions: GoalContributionsTable;
  audit_logs: AuditLogsTable;
  exchange_rate_snapshots: ExchangeRateSnapshotsTable;
}
