from sqlalchemy import (
    CheckConstraint, Column, Computed, String, DateTime, Date, Boolean, Integer,
    Numeric, Text, ForeignKey
)
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    def is_deleted(self):
        return self.deleted_at is not None


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def is_expired(self):
        return datetime.now(timezone.utc) > self.expires_at

    def is_used(self):
        return self.used_at is not None


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def is_expired(self):
        return datetime.now(timezone.utc) > self.expires_at

    def is_revoked(self):
        return self.revoked_at is not None

    def is_valid(self):
        return not self.is_expired() and not self.is_revoked()


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    success = Column(Boolean, default=False)
    ip_address = Column(String(45), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    event_name = Column(String(100), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_ids = Column(String(500), nullable=True)
    result = Column(String(20), nullable=False)
    error_code = Column(String(50), nullable=True)
    ip_address = Column(String(45), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    details = Column(Text, nullable=True)


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        CheckConstraint("currency IN ('VND', 'USD')", name="chk_workspaces_currency"),
    )

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # Preferred currency: every summary and report is expressed in this (BR-07a).
    currency = Column(String(3), default="USD", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    def is_deleted(self):
        return self.deleted_at is not None


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class WorkspaceInvitation(Base):
    __tablename__ = "workspace_invitations"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    token = Column(String(255), unique=True, index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def is_expired(self):
        return datetime.now(timezone.utc) > self.expires_at

    def is_accepted(self):
        return self.accepted_at is not None

    def is_rejected(self):
        return self.rejected_at is not None


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)
    color = Column(String(7), nullable=True)
    icon = Column(String(50), nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    def is_deleted(self):
        return self.deleted_at is not None


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        CheckConstraint("currency IN ('VND', 'USD')", name="chk_accounts_currency"),
        CheckConstraint("exchange_rate > 0", name="chk_accounts_exchange_rate"),
    )

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    currency = Column(String(3), nullable=False)
    balance = Column(Numeric(15, 2), nullable=False, default=0)
    opening_balance = Column(Numeric(15, 2), nullable=False, default=0)
    # Rate to the workspace preferred currency at the time the account was opened,
    # fetched by the system. 1 when the currencies match; immutable afterwards
    # (BR-07). Ten decimal places because VND->USD is ~0.0000382.
    exchange_rate = Column(Numeric(18, 10), nullable=False, default=1)
    opening_base_balance = Column(
        Numeric(15, 2),
        Computed("opening_balance * exchange_rate", persisted=True)
    )
    institution = Column(String(255), nullable=True)
    account_number = Column(String(255), nullable=True)  # masked — last 4 digits only
    color = Column(String(7), nullable=True)
    icon = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    def is_deleted(self):
        return self.deleted_at is not None

    def is_archived(self):
        """Archiving is the soft-delete for accounts (ACC-US-04)."""
        return self.deleted_at is not None


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("currency IN ('VND', 'USD')", name="chk_transactions_currency"),
        CheckConstraint("exchange_rate > 0", name="chk_transactions_exchange_rate"),
        CheckConstraint("direction IN ('debit', 'credit')", name="chk_transactions_direction"),
    )

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    # Nullable because a TRANSFER moves money between accounts and has no
    # income/expense classification (see SDS §4.3.3 note).
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    type = Column(String(50), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    # Which way the money moved for this account: 'debit' reduced the balance,
    # 'credit' increased it. Amount is always positive, so without this the two
    # legs of a TRANSFER are indistinguishable and no per-account balance can be
    # reconstructed from the rows.
    direction = Column(String(6), nullable=False)
    currency = Column(String(3), nullable=False)
    # Snapshot of the rate to the workspace preferred currency at recording time,
    # fetched by the system. Later rate movements never restate a recorded
    # transaction (BR-07). Ten decimal places because VND->USD is ~0.0000382.
    exchange_rate = Column(Numeric(18, 10), nullable=False, default=1)
    # Amount in the workspace preferred currency — what every summary sums.
    base_amount = Column(
        Numeric(15, 2),
        Computed("amount * exchange_rate", persisted=True)
    )
    date = Column(Date, nullable=False, index=True)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    receipt_url = Column(String(1024), nullable=True)
    location = Column(String(255), nullable=True)
    tags = Column(Text, nullable=True)  # comma-separated
    # Links the debit/credit pair produced by one transfer (TXN-US-03).
    transfer_group_id = Column(String(36), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="recorded")
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    def is_deleted(self):
        return self.deleted_at is not None

    def is_cancelled(self):
        return self.status == "cancelled"
