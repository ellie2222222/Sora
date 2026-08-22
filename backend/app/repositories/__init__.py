from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_
from datetime import datetime, timezone, timedelta, date as date_type
from decimal import Decimal
from app import models
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# User CRUD
def create_user(db: Session, email: str, password: str, full_name: str = None) -> models.User:
    db_user = models.User(
        email=email,
        password_hash=get_password_hash(password),
        full_name=full_name,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_email(db: Session, email: str) -> models.User:
    return db.query(models.User).filter(
        and_(
            models.User.email == email,
            models.User.deleted_at == None
        )
    ).first()


def get_user_by_id(db: Session, user_id: int) -> models.User:
    return db.query(models.User).filter(
        and_(
            models.User.id == user_id,
            models.User.deleted_at == None
        )
    ).first()


def update_user_email_verified(db: Session, user_id: int) -> models.User:
    db_user = get_user_by_id(db, user_id)
    if db_user:
        db_user.email_verified = True
        db_user.email_verified_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_user)
    return db_user


# Email Verification Token CRUD
def create_email_verification_token(db: Session, user_id: int, token: str, expires_at: datetime) -> models.EmailVerificationToken:
    db_token = models.EmailVerificationToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token


def get_email_verification_token(db: Session, token: str) -> models.EmailVerificationToken:
    return db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.token == token
    ).first()


def mark_email_verification_token_used(db: Session, token_id: int) -> models.EmailVerificationToken:
    db_token = db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.id == token_id
    ).first()
    if db_token:
        db_token.used_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_token)
    return db_token


# Refresh Token CRUD
def create_refresh_token(db: Session, user_id: int, token: str, expires_at: datetime) -> models.RefreshToken:
    db_token = models.RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token


def get_refresh_token(db: Session, token: str) -> models.RefreshToken:
    return db.query(models.RefreshToken).filter(
        models.RefreshToken.token == token
    ).first()


def revoke_refresh_token(db: Session, token: str) -> models.RefreshToken:
    db_token = get_refresh_token(db, token)
    if db_token:
        db_token.revoked_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_token)
    return db_token


# Login Attempt CRUD
def create_login_attempt(db: Session, email: str, success: bool, ip_address: str) -> models.LoginAttempt:
    db_attempt = models.LoginAttempt(
        email=email,
        success=success,
        ip_address=ip_address
    )
    db.add(db_attempt)
    db.commit()
    db.refresh(db_attempt)
    return db_attempt


def get_recent_failed_login_attempts(db: Session, email: str, minutes: int = 15) -> list:
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    return db.query(models.LoginAttempt).filter(
        and_(
            models.LoginAttempt.email == email,
            models.LoginAttempt.success == False,
            models.LoginAttempt.created_at >= cutoff_time
        )
    ).all()


# Audit Log CRUD
def create_audit_log(
    db: Session,
    event_name: str,
    action: str,
    result: str,
    ip_address: str,
    user_id: int = None,
    entity_type: str = None,
    entity_ids: str = None,
    error_code: str = None,
    details: str = None
) -> models.AuditLog:
    db_log = models.AuditLog(
        user_id=user_id,
        event_name=event_name,
        action=action,
        entity_type=entity_type,
        entity_ids=entity_ids,
        result=result,
        error_code=error_code,
        ip_address=ip_address,
        details=details
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


# Workspace CRUD
def create_workspace(db: Session, owner_id: int, name: str, description: str = None, currency: str = "USD") -> models.Workspace:
    db_workspace = models.Workspace(
        owner_id=owner_id,
        name=name,
        description=description,
        currency=currency
    )
    db.add(db_workspace)
    db.flush()
    workspace_id = db_workspace.id

    # Add owner as OWNER member
    db_member = models.WorkspaceMember(
        workspace_id=workspace_id,
        user_id=owner_id,
        role="OWNER"
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_workspace)
    return db_workspace


def get_workspace(db: Session, workspace_id: int) -> models.Workspace:
    return db.query(models.Workspace).filter(
        and_(
            models.Workspace.id == workspace_id,
            models.Workspace.deleted_at == None
        )
    ).first()


def list_user_workspaces(db: Session, user_id: int) -> list:
    return db.query(models.Workspace).join(
        models.WorkspaceMember,
        models.Workspace.id == models.WorkspaceMember.workspace_id
    ).filter(
        and_(
            models.WorkspaceMember.user_id == user_id,
            models.Workspace.deleted_at == None
        )
    ).all()


def update_workspace(db: Session, workspace_id: int, name: str = None, description: str = None) -> models.Workspace:
    """Currency is changed only by WorkspaceService.change_preferred_currency."""
    db_workspace = get_workspace(db, workspace_id)
    if db_workspace:
        if name:
            db_workspace.name = name
        if description:
            db_workspace.description = description
        db.commit()
        db.refresh(db_workspace)
    return db_workspace


def delete_workspace(db: Session, workspace_id: int) -> models.Workspace:
    db_workspace = get_workspace(db, workspace_id)
    if db_workspace:
        db_workspace.deleted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_workspace)
    return db_workspace


# WorkspaceMember CRUD
def add_workspace_member(db: Session, workspace_id: int, user_id: int, role: str) -> models.WorkspaceMember:
    db_member = models.WorkspaceMember(
        workspace_id=workspace_id,
        user_id=user_id,
        role=role
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


def get_workspace_member(db: Session, workspace_id: int, user_id: int) -> models.WorkspaceMember:
    return db.query(models.WorkspaceMember).filter(
        and_(
            models.WorkspaceMember.workspace_id == workspace_id,
            models.WorkspaceMember.user_id == user_id
        )
    ).first()


def list_workspace_members(db: Session, workspace_id: int) -> list:
    return db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id
    ).all()


def update_member_role(db: Session, workspace_id: int, user_id: int, role: str) -> models.WorkspaceMember:
    db_member = get_workspace_member(db, workspace_id, user_id)
    if db_member:
        db_member.role = role
        db.commit()
        db.refresh(db_member)
    return db_member


def remove_workspace_member(db: Session, workspace_id: int, user_id: int) -> bool:
    db_member = get_workspace_member(db, workspace_id, user_id)
    if db_member:
        db.delete(db_member)
        db.commit()
        return True
    return False


# WorkspaceInvitation CRUD
def create_invitation(db: Session, workspace_id: int, email: str, role: str, created_by: int, token: str, expires_at: datetime) -> models.WorkspaceInvitation:
    db_invitation = models.WorkspaceInvitation(
        workspace_id=workspace_id,
        email=email,
        role=role,
        created_by=created_by,
        token=token,
        expires_at=expires_at
    )
    db.add(db_invitation)
    db.commit()
    db.refresh(db_invitation)
    return db_invitation


def get_invitation_by_token(db: Session, token: str) -> models.WorkspaceInvitation:
    return db.query(models.WorkspaceInvitation).filter(
        models.WorkspaceInvitation.token == token
    ).first()


def list_workspace_invitations(db: Session, workspace_id: int) -> list:
    return db.query(models.WorkspaceInvitation).filter(
        and_(
            models.WorkspaceInvitation.workspace_id == workspace_id,
            models.WorkspaceInvitation.accepted_at == None,
            models.WorkspaceInvitation.rejected_at == None
        )
    ).all()


def accept_invitation(db: Session, invitation_id: int) -> models.WorkspaceInvitation:
    db_invitation = db.query(models.WorkspaceInvitation).filter(
        models.WorkspaceInvitation.id == invitation_id
    ).first()
    if db_invitation:
        db_invitation.accepted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_invitation)
    return db_invitation


def reject_invitation(db: Session, invitation_id: int) -> models.WorkspaceInvitation:
    db_invitation = db.query(models.WorkspaceInvitation).filter(
        models.WorkspaceInvitation.id == invitation_id
    ).first()
    if db_invitation:
        db_invitation.rejected_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_invitation)
    return db_invitation


# Category CRUD
def create_category(
    db: Session,
    workspace_id: int,
    name: str,
    type: str,
    color: str = None,
    icon: str = None,
    is_default: bool = False
) -> models.Category:
    db_category = models.Category(
        workspace_id=workspace_id,
        name=name,
        type=type,
        color=color,
        icon=icon,
        is_default=is_default
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def get_category(db: Session, category_id: int) -> models.Category:
    return db.query(models.Category).filter(
        and_(
            models.Category.id == category_id,
            models.Category.deleted_at == None
        )
    ).first()


def list_workspace_categories(
    db: Session,
    workspace_id: int,
    type: str = None,
    include_archived: bool = False
) -> list:
    query = db.query(models.Category).filter(
        models.Category.workspace_id == workspace_id
    )
    if not include_archived:
        query = query.filter(models.Category.deleted_at == None)
    if type:
        query = query.filter(models.Category.type == type)
    return query.order_by(models.Category.type, models.Category.name).all()


def get_category_by_name(db: Session, workspace_id: int, name: str) -> models.Category:
    """Active category with this name in the workspace (uniqueness check, VL-02)."""
    return db.query(models.Category).filter(
        and_(
            models.Category.workspace_id == workspace_id,
            func.lower(models.Category.name) == name.lower(),
            models.Category.deleted_at == None
        )
    ).first()


def update_category(db: Session, category_id: int, name: str = None, color: str = None, icon: str = None) -> models.Category:
    db_category = get_category(db, category_id)
    if db_category:
        if name:
            db_category.name = name
        if color:
            db_category.color = color
        if icon:
            db_category.icon = icon
        db.commit()
        db.refresh(db_category)
    return db_category


def delete_category(db: Session, category_id: int) -> models.Category:
    db_category = get_category(db, category_id)
    if db_category:
        db_category.deleted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_category)
    return db_category


# Account CRUD
def create_account(
    db: Session,
    workspace_id: int,
    type: str,
    name: str,
    currency: str,
    opening_balance: Decimal,
    institution: str = None,
    account_number: str = None,
    color: str = None,
    icon: str = None,
    exchange_rate: Decimal = None
) -> models.Account:
    db_account = models.Account(
        workspace_id=workspace_id,
        type=type,
        name=name,
        currency=currency,
        opening_balance=opening_balance,
        balance=opening_balance,
        exchange_rate=exchange_rate if exchange_rate is not None else Decimal("1"),
        institution=institution,
        account_number=account_number,
        color=color,
        icon=icon
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


def get_account(db: Session, account_id: int, include_archived: bool = True) -> models.Account:
    query = db.query(models.Account).filter(models.Account.id == account_id)
    if not include_archived:
        query = query.filter(models.Account.deleted_at == None)
    return query.first()


def list_workspace_accounts(
    db: Session,
    workspace_id: int,
    status: str = None,
    page: int = 1,
    page_size: int = 25
) -> tuple:
    """Returns (accounts, total). `status` is 'active' or 'archived'."""
    query = db.query(models.Account).filter(models.Account.workspace_id == workspace_id)

    if status == "active":
        query = query.filter(models.Account.deleted_at == None)
    elif status == "archived":
        query = query.filter(models.Account.deleted_at != None)

    total = query.count()
    accounts = (
        query.order_by(models.Account.deleted_at.is_(None).desc(), models.Account.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return accounts, total


def get_account_by_name(db: Session, workspace_id: int, name: str) -> models.Account:
    """Active account with this name in the workspace (uniqueness check, VL-02)."""
    return db.query(models.Account).filter(
        and_(
            models.Account.workspace_id == workspace_id,
            func.lower(models.Account.name) == name.lower(),
            models.Account.deleted_at == None
        )
    ).first()


def update_account(
    db: Session,
    account_id: int,
    name: str = None,
    institution: str = None,
    account_number: str = None,
    color: str = None,
    icon: str = None
) -> models.Account:
    """Type, opening_balance and currency are immutable (SDS §5.4 ACC-US-03)."""
    db_account = get_account(db, account_id)
    if db_account:
        if name is not None:
            db_account.name = name
        if institution is not None:
            db_account.institution = institution
        if account_number is not None:
            db_account.account_number = account_number
        if color is not None:
            db_account.color = color
        if icon is not None:
            db_account.icon = icon
        db.commit()
        db.refresh(db_account)
    return db_account


def archive_account(db: Session, account_id: int) -> models.Account:
    db_account = get_account(db, account_id)
    if db_account:
        db_account.deleted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_account)
    return db_account


def adjust_account_balance(db: Session, account_id: int, delta: Decimal) -> models.Account:
    """Applies a signed balance change. Caller owns the surrounding transaction."""
    db_account = get_account(db, account_id)
    if db_account:
        db_account.balance = (db_account.balance or Decimal("0")) + delta
        db.flush()
    return db_account


# Transaction CRUD
def create_transaction(
    db: Session,
    workspace_id: int,
    account_id: int,
    type: str,
    amount: Decimal,
    currency: str,
    date: date_type,
    created_by: int,
    direction: str,
    category_id: int = None,
    description: str = None,
    notes: str = None,
    tags: str = None,
    receipt_url: str = None,
    location: str = None,
    transfer_group_id: str = None,
    exchange_rate: Decimal = None,
    commit: bool = True
) -> models.Transaction:
    db_transaction = models.Transaction(
        workspace_id=workspace_id,
        account_id=account_id,
        category_id=category_id,
        type=type,
        amount=amount,
        direction=direction,
        currency=currency,
        exchange_rate=exchange_rate if exchange_rate is not None else Decimal("1"),
        date=date,
        description=description,
        notes=notes,
        tags=tags,
        receipt_url=receipt_url,
        location=location,
        transfer_group_id=transfer_group_id,
        created_by=created_by,
        status="recorded"
    )
    db.add(db_transaction)
    if commit:
        db.commit()
        db.refresh(db_transaction)
    else:
        db.flush()
    return db_transaction


def get_transaction(db: Session, transaction_id: int) -> models.Transaction:
    return db.query(models.Transaction).filter(
        and_(
            models.Transaction.id == transaction_id,
            models.Transaction.deleted_at == None
        )
    ).first()


def list_workspace_transactions(
    db: Session,
    workspace_id: int,
    account_id: int = None,
    category_id: int = None,
    type: str = None,
    status: str = None,
    min_amount: Decimal = None,
    max_amount: Decimal = None,
    start_date: date_type = None,
    end_date: date_type = None,
    search: str = None,
    sort_by: str = "-date",
    page: int = 1,
    page_size: int = 25
) -> tuple:
    """Returns (transactions, total) for TXN-US-04 filtering and paging."""
    query = db.query(models.Transaction).filter(
        and_(
            models.Transaction.workspace_id == workspace_id,
            models.Transaction.deleted_at == None
        )
    )

    if account_id is not None:
        query = query.filter(models.Transaction.account_id == account_id)
    if category_id is not None:
        query = query.filter(models.Transaction.category_id == category_id)
    if type:
        query = query.filter(models.Transaction.type == type)
    if status:
        query = query.filter(models.Transaction.status == status)
    if min_amount is not None:
        query = query.filter(models.Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(models.Transaction.amount <= max_amount)
    if start_date is not None:
        query = query.filter(models.Transaction.date >= start_date)
    if end_date is not None:
        query = query.filter(models.Transaction.date <= end_date)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                models.Transaction.description.ilike(pattern),
                models.Transaction.notes.ilike(pattern),
                models.Transaction.tags.ilike(pattern)
            )
        )

    total = query.count()

    sortable = {
        "date": models.Transaction.date,
        "amount": models.Transaction.amount,
        "type": models.Transaction.type,
        "created_at": models.Transaction.created_at,
    }
    field = (sort_by or "-date").lstrip("-")
    column = sortable.get(field, models.Transaction.date)
    descending = (sort_by or "-date").startswith("-")
    order = column.desc() if descending else column.asc()

    transactions = (
        query.order_by(order, models.Transaction.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return transactions, total


def update_transaction_metadata(
    db: Session,
    transaction_id: int,
    category_id: int = None,
    description: str = None,
    notes: str = None,
    tags: str = None,
    clear_category: bool = False
) -> models.Transaction:
    """
    Amount and account are immutable once recorded (BR-03) — metadata only.

    `None` means "leave as is", so removing a category needs its own flag:
    otherwise a transaction could be classified but never unclassified.
    """
    db_transaction = get_transaction(db, transaction_id)
    if db_transaction:
        if clear_category:
            db_transaction.category_id = None
        elif category_id is not None:
            db_transaction.category_id = category_id
        if description is not None:
            db_transaction.description = description
        if notes is not None:
            db_transaction.notes = notes
        if tags is not None:
            db_transaction.tags = tags
        db.commit()
        db.refresh(db_transaction)
    return db_transaction


def cancel_transaction(db: Session, transaction_id: int, reason: str = None) -> models.Transaction:
    db_transaction = get_transaction(db, transaction_id)
    if db_transaction:
        db_transaction.status = "cancelled"
        db_transaction.cancelled_at = datetime.now(timezone.utc)
        db_transaction.cancel_reason = reason
        db.flush()
    return db_transaction


def list_transfer_group(db: Session, transfer_group_id: str) -> list:
    return db.query(models.Transaction).filter(
        and_(
            models.Transaction.transfer_group_id == transfer_group_id,
            models.Transaction.deleted_at == None
        )
    ).all()


def count_active_transactions_for_category(db: Session, category_id: int) -> int:
    """Blocks category archival while it still classifies live transactions (CATEGORY_IN_USE)."""
    return db.query(models.Transaction).filter(
        and_(
            models.Transaction.category_id == category_id,
            models.Transaction.status == "recorded",
            models.Transaction.deleted_at == None
        )
    ).count()


def count_active_transactions_for_account(db: Session, account_id: int) -> int:
    return db.query(models.Transaction).filter(
        and_(
            models.Transaction.account_id == account_id,
            models.Transaction.status == "recorded",
            models.Transaction.deleted_at == None
        )
    ).count()
