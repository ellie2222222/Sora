import email_validator
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional

# Internal accounts live on the reserved `.local` TLD (e.g. admin.user@globee.local),
# which email-validator rejects as a special-use domain by default. EmailStr reads this
# list at validation time, so dropping `local` here re-enables those addresses.
email_validator.SPECIAL_USE_DOMAIN_NAMES = [
    name for name in email_validator.SPECIAL_USE_DOMAIN_NAMES if name != "local"
]


class Currency(str, Enum):
    """Supported currencies (SRS BR-07). VND and USD only — nothing else is accepted."""

    VND = "VND"
    USD = "USD"


class WorkspaceRole(str, Enum):
    """Workspace-level roles (SRS §7, CLAUDE.md AC-01). Fixed set; no custom roles."""

    OWNER = "OWNER"
    MEMBER = "MEMBER"


# Response envelope
class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    timestamp: datetime


# Auth Request/Response DTOs
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Optional[str] = None


class RegisterResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    email_verified: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: dict


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class VerifyEmailRequest(BaseModel):
    token: str


class VerifyEmailResponse(BaseModel):
    email: str
    verified_at: datetime
    message: str


class LogoutRequest(BaseModel):
    refresh_token: str


class TokenPayload(BaseModel):
    sub: str  # user_id
    email: str
    iat: int
    exp: int


# Error Response
class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    error_code: str
    timestamp: datetime


# Workspace Request/Response DTOs
class CreateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    # Preferred currency: every summary for this workspace is expressed in it.
    currency: Currency = Currency.USD


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    currency: str
    owner_id: int
    created_at: datetime
    user_role: Optional[str] = None


class UpdateWorkspaceRequest(BaseModel):
    """
    Currency is absent on purpose: changing the preferred currency re-snapshots
    every stored rate, so it goes through its own endpoint rather than riding
    along with a name edit (see ChangePreferredCurrencyRequest).
    """

    name: Optional[str] = None
    description: Optional[str] = None


class ChangePreferredCurrencyRequest(BaseModel):
    currency: Currency


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: WorkspaceRole


class InvitationResponse(BaseModel):
    id: int
    email: str
    role: str
    token: str
    expires_at: datetime


class AcceptInvitationRequest(BaseModel):
    token: str


class UpdateMemberRoleRequest(BaseModel):
    role: WorkspaceRole


class WorkspaceMemberResponse(BaseModel):
    id: int
    user_id: int
    workspace_id: int
    role: str
    joined_at: datetime


class CategoryResponse(BaseModel):
    id: int
    workspace_id: int
    name: str
    type: str
    color: Optional[str]
    icon: Optional[str]
    created_at: datetime


class CategoryType(str, Enum):
    """Category classification (SDS §4.3.3)."""

    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class AccountType(str, Enum):
    """Account types from ACC-US-01."""

    CASH = "CASH"
    BANK_ACCOUNT = "BANK_ACCOUNT"
    CREDIT_CARD = "CREDIT_CARD"
    DEBIT_CARD = "DEBIT_CARD"
    SAVINGS = "SAVINGS"
    INVESTMENT = "INVESTMENT"
    CRYPTO = "CRYPTO"
    DIGITAL_WALLET = "DIGITAL_WALLET"


class TransactionType(str, Enum):
    """Transaction types from SRS §1.4."""

    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    TRANSFER = "TRANSFER"
    REFUND = "REFUND"
    INVESTMENT = "INVESTMENT"
    LOAN = "LOAN"
    DEBT = "DEBT"


# Category DTOs (CAT-US-01)
class CreateCategoryRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: CategoryType
    color: Optional[str] = Field(default=None, max_length=7)
    icon: Optional[str] = Field(default=None, max_length=50)


class UpdateCategoryRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = Field(default=None, max_length=7)
    icon: Optional[str] = Field(default=None, max_length=50)


# Account DTOs (ACC-US-01 … ACC-US-04)
class CreateAccountRequest(BaseModel):
    type: AccountType
    name: str = Field(min_length=1, max_length=255)
    currency: Currency
    opening_balance: Decimal = Field(default=Decimal("0"), max_digits=15, decimal_places=2)
    # No exchange_rate field: the rate converting the opening balance into the
    # workspace preferred currency is fetched server-side and snapshotted (BR-07a).
    institution: Optional[str] = Field(default=None, max_length=255)
    account_number: Optional[str] = Field(default=None, max_length=255)
    color: Optional[str] = Field(default=None, max_length=7)
    icon: Optional[str] = Field(default=None, max_length=50)


class UpdateAccountRequest(BaseModel):
    """
    Type, opening balance and currency are immutable after creation (SDS §5.4).

    Currency in particular: the balance, the opening balance and the snapshot rate
    are all denominated in it, and none of them can be restated. Changing the code
    alone would relabel a VND balance as USD.
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    institution: Optional[str] = Field(default=None, max_length=255)
    account_number: Optional[str] = Field(default=None, max_length=255)
    color: Optional[str] = Field(default=None, max_length=7)
    icon: Optional[str] = Field(default=None, max_length=50)


class AccountResponse(BaseModel):
    id: int
    workspace_id: int
    type: str
    name: str
    currency: str
    balance: Decimal
    opening_balance: Decimal
    exchange_rate: Decimal
    opening_base_balance: Optional[Decimal] = None
    institution: Optional[str]
    account_number: Optional[str]
    color: Optional[str]
    icon: Optional[str]
    status: str
    created_at: datetime


# Transaction DTOs (TXN-US-01 … TXN-US-05)
class CreateTransactionRequest(BaseModel):
    account_id: int
    type: TransactionType
    amount: Decimal = Field(gt=0, max_digits=15, decimal_places=2)
    # No exchange_rate field: the rate to the workspace preferred currency is
    # fetched server-side at recording time and snapshotted on the row (BR-07a).
    date: date
    category_id: Optional[int] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    receipt_url: Optional[str] = Field(default=None, max_length=1024)
    location: Optional[str] = Field(default=None, max_length=255)


class CreateTransferRequest(BaseModel):
    """TXN-US-03: one atomic operation producing a linked debit/credit pair."""

    from_account_id: int
    to_account_id: int
    amount: Decimal = Field(gt=0, max_digits=15, decimal_places=2)
    # One snapshot per leg, both fetched server-side: the two accounts may hold
    # different currencies.
    date: date
    description: Optional[str] = None
    notes: Optional[str] = None


class UpdateTransactionRequest(BaseModel):
    """Amount and account are immutable once recorded (BR-03) — metadata only."""

    category_id: Optional[int] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None


class CancelTransactionRequest(BaseModel):
    reason: Optional[str] = None


class TransactionResponse(BaseModel):
    id: int
    workspace_id: int
    account_id: int
    account_name: Optional[str] = None
    category_id: Optional[int]
    category_name: Optional[str] = None
    type: str
    amount: Decimal
    currency: str
    exchange_rate: Decimal
    base_amount: Optional[Decimal] = None
    date: date
    description: Optional[str]
    notes: Optional[str]
    tags: Optional[str]
    status: str
    created_by: int
    created_at: datetime
