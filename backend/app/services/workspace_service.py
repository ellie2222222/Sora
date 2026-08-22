import logging
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from app import models
from app.repositories import (
    create_workspace, get_workspace, list_user_workspaces, update_workspace,
    delete_workspace, get_workspace_member, add_workspace_member,
    create_category, create_audit_log, get_user_by_email, get_user_by_id,
    create_invitation, get_invitation_by_token, accept_invitation,
    reject_invitation, update_member_role, remove_workspace_member
)
from app.core.jwt_utils import create_email_verification_token as create_email_token
from app.services.currency import normalise_currency
from app.services.exchange_rate_service import snapshot_rate

logger = logging.getLogger(__name__)


DEFAULT_CATEGORIES = [
    # Income categories
    {"name": "Salary", "type": "INCOME", "icon": "briefcase"},
    {"name": "Freelance", "type": "INCOME", "icon": "code"},
    {"name": "Investment", "type": "INCOME", "icon": "trending-up"},
    {"name": "Bonus", "type": "INCOME", "icon": "gift"},
    {"name": "Other Income", "type": "INCOME", "icon": "plus-circle"},
    # Expense categories
    {"name": "Food & Dining", "type": "EXPENSE", "icon": "utensils"},
    {"name": "Transportation", "type": "EXPENSE", "icon": "car"},
    {"name": "Shopping", "type": "EXPENSE", "icon": "shopping-bag"},
    {"name": "Entertainment", "type": "EXPENSE", "icon": "film"},
    {"name": "Utilities", "type": "EXPENSE", "icon": "zap"},
    {"name": "Healthcare", "type": "EXPENSE", "icon": "heart"},
    {"name": "Education", "type": "EXPENSE", "icon": "book"},
    {"name": "Travel", "type": "EXPENSE", "icon": "plane"},
    {"name": "Subscription", "type": "EXPENSE", "icon": "repeat"},
    {"name": "Other Expense", "type": "EXPENSE", "icon": "minus-circle"},
]


class WorkspaceService:
    @staticmethod
    def create_workspace(
        db: Session,
        user_id: int,
        name: str,
        description: str = None,
        currency: str = "USD",
        ip_address: str = None
    ) -> dict:
        """
        Create a new workspace and initialize default categories.

        `currency` is the preferred currency every summary for this workspace is
        reported in; only VND and USD are accepted (BR-07).
        """
        ip_address = ip_address or "unknown"

        workspace = create_workspace(db, user_id, name, description, normalise_currency(currency))

        # Create default categories
        for cat_data in DEFAULT_CATEGORIES:
            create_category(
                db,
                workspace.id,
                cat_data["name"],
                cat_data["type"],
                icon=cat_data["icon"],
                is_default=True
            )

        # Log event
        create_audit_log(
            db,
            event_name="WS_AUDIT",
            action="event=WS_CREATE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Workspace",
            entity_ids=f"workspace_id={workspace.id}"
        )

        return {
            "id": workspace.id,
            "name": workspace.name,
            "description": workspace.description,
            "currency": workspace.currency,
            "owner_id": workspace.owner_id,
            "created_at": workspace.created_at
        }

    @staticmethod
    def get_workspace(db: Session, workspace_id: int, user_id: int, ip_address: str = None) -> dict:
        """Get workspace if user is a member."""
        ip_address = ip_address or "unknown"

        workspace = get_workspace(db, workspace_id)
        if not workspace:
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_GET",
                result="failure",
                error_code="WORKSPACE_NOT_FOUND",
                ip_address=ip_address,
                user_id=user_id
            )
            raise ValueError("WORKSPACE_NOT_FOUND")

        # Check membership
        member = get_workspace_member(db, workspace_id, user_id)
        if not member:
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_GET",
                result="failure",
                error_code="PERMISSION_DENIED",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Workspace",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise ValueError("PERMISSION_DENIED")

        return {
            "id": workspace.id,
            "name": workspace.name,
            "description": workspace.description,
            "currency": workspace.currency,
            "owner_id": workspace.owner_id,
            "created_at": workspace.created_at,
            "user_role": member.role
        }

    @staticmethod
    def list_user_workspaces(db: Session, user_id: int, ip_address: str = None) -> list:
        """List all workspaces for a user."""
        workspaces = list_user_workspaces(db, user_id)
        return [
            {
                "id": ws.id,
                "name": ws.name,
                "description": ws.description,
                "currency": ws.currency,
                "owner_id": ws.owner_id,
                "created_at": ws.created_at
            }
            for ws in workspaces
        ]

    @staticmethod
    def update_workspace(
        db: Session,
        workspace_id: int,
        user_id: int,
        name: str = None,
        description: str = None,
        ip_address: str = None
    ) -> dict:
        """
        Update workspace (OWNER only).

        Currency is not editable here — it re-snapshots every stored rate, so it
        has its own operation (change_preferred_currency).
        """
        ip_address = ip_address or "unknown"

        # Check membership and role
        member = get_workspace_member(db, workspace_id, user_id)
        if not member or member.role != "OWNER":
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_UPDATE",
                result="failure",
                error_code="PERMISSION_DENIED",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Workspace",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise ValueError("PERMISSION_DENIED")

        workspace = update_workspace(db, workspace_id, name, description)

        create_audit_log(
            db,
            event_name="WS_AUDIT",
            action="event=WS_UPDATE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Workspace",
            entity_ids=f"workspace_id={workspace_id}"
        )

        return {
            "id": workspace.id,
            "name": workspace.name,
            "description": workspace.description,
            "currency": workspace.currency,
            "owner_id": workspace.owner_id,
            "created_at": workspace.created_at
        }

    @staticmethod
    def change_preferred_currency(
        db: Session,
        workspace_id: int,
        user_id: int,
        currency: str,
        ip_address: str = None
    ) -> dict:
        """
        Change the currency every summary is expressed in (OWNER only).

        Each stored rate converts a row's own currency into the preferred
        currency, so a new preferred currency makes every stored rate wrong. This
        re-snapshots them all: rows already held in the new currency get exactly
        1 — lossless — and rows in the other currency get the rate resolved now.

        That last part is a deliberate loss of fidelity, and the only option
        available: the historical rate for the new pair was never recorded, so an
        old foreign-currency row is restated at today's rate. Switching to the
        currency your money is actually in has no such rows and is exact.

        Returns the workspace plus how many rows were restated.
        """
        ip_address = ip_address or "unknown"
        action = "event=WS_CURRENCY_CHANGE"

        member = get_workspace_member(db, workspace_id, user_id)
        if not member or member.role != "OWNER":
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action=action,
                result="failure",
                error_code="PERMISSION_DENIED",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Workspace",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise ValueError("PERMISSION_DENIED")

        workspace = get_workspace(db, workspace_id)
        if not workspace:
            raise ValueError("WORKSPACE_NOT_FOUND")

        code = normalise_currency(currency)
        previous = workspace.currency
        if code == previous:
            return {
                "id": workspace.id,
                "name": workspace.name,
                "description": workspace.description,
                "currency": workspace.currency,
                "owner_id": workspace.owner_id,
                "created_at": workspace.created_at,
                "restated_accounts": 0,
                "restated_transactions": 0,
            }

        accounts = (
            db.query(models.Account)
            .filter(models.Account.workspace_id == workspace_id)
            .all()
        )
        transactions = (
            db.query(models.Transaction)
            .filter(models.Transaction.workspace_id == workspace_id)
            .all()
        )

        # Resolved once per currency, not per row: snapshot_rate caches, but this
        # also keeps a provider outage from half-applying the change.
        rates = {}
        for row_currency in {a.currency for a in accounts} | {t.currency for t in transactions}:
            rates[row_currency] = snapshot_rate(code, row_currency)

        try:
            for account in accounts:
                account.exchange_rate = rates[account.currency]
            for transaction in transactions:
                transaction.exchange_rate = rates[transaction.currency]
            workspace.currency = code
            db.commit()
        except Exception:
            db.rollback()
            raise
        db.refresh(workspace)

        logger.info(
            f"[WS] Preferred currency {previous} -> {code} for workspace {workspace_id}: "
            f"{len(accounts)} account(s), {len(transactions)} transaction(s) restated"
        )
        create_audit_log(
            db,
            event_name="WS_AUDIT",
            action=action,
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Workspace",
            entity_ids=f"workspace_id={workspace_id}",
            details=f"old_currency={previous} new_currency={code}"
        )

        return {
            "id": workspace.id,
            "name": workspace.name,
            "description": workspace.description,
            "currency": workspace.currency,
            "owner_id": workspace.owner_id,
            "created_at": workspace.created_at,
            "restated_accounts": len(accounts),
            "restated_transactions": len(transactions),
        }

    @staticmethod
    def delete_workspace(db: Session, workspace_id: int, user_id: int, ip_address: str = None) -> dict:
        """Delete workspace (OWNER only, soft delete)."""
        ip_address = ip_address or "unknown"

        # Check membership and role
        member = get_workspace_member(db, workspace_id, user_id)
        if not member or member.role != "OWNER":
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_DELETE",
                result="failure",
                error_code="PERMISSION_DENIED",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Workspace",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise ValueError("PERMISSION_DENIED")

        workspace = delete_workspace(db, workspace_id)

        create_audit_log(
            db,
            event_name="WS_AUDIT",
            action="event=WS_DELETE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Workspace",
            entity_ids=f"workspace_id={workspace_id}"
        )

        return {"message": "Workspace deleted"}

    @staticmethod
    def invite_member(
        db: Session,
        workspace_id: int,
        email: str,
        role: str,
        user_id: int,
        ip_address: str = None
    ) -> dict:
        """Invite a user to workspace (OWNER only)."""
        ip_address = ip_address or "unknown"

        # Check membership and role
        member = get_workspace_member(db, workspace_id, user_id)
        if not member or member.role != "OWNER":
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_INVITE_SEND",
                result="failure",
                error_code="PERMISSION_DENIED",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Workspace",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise ValueError("PERMISSION_DENIED")

        # Check workspace exists
        workspace = get_workspace(db, workspace_id)
        if not workspace:
            raise ValueError("WORKSPACE_NOT_FOUND")

        # Check if email already a member
        existing_user = get_user_by_email(db, email)
        if existing_user:
            existing_member = get_workspace_member(db, workspace_id, existing_user.id)
            if existing_member:
                create_audit_log(
                    db,
                    event_name="WS_AUDIT",
                    action="event=WS_INVITE_SEND",
                    result="failure",
                    error_code="USER_ALREADY_MEMBER",
                    ip_address=ip_address,
                    user_id=user_id,
                    entity_type="Workspace",
                    entity_ids=f"workspace_id={workspace_id}"
                )
                raise ValueError("USER_ALREADY_MEMBER")

        # Create invitation
        token = create_email_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        invitation = create_invitation(db, workspace_id, email, role, user_id, token, expires_at)

        create_audit_log(
            db,
            event_name="WS_AUDIT",
            action="event=WS_INVITE_SEND",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Workspace",
            entity_ids=f"workspace_id={workspace_id} invitation_id={invitation.id}"
        )

        return {
            "id": invitation.id,
            "email": invitation.email,
            "role": invitation.role,
            "token": invitation.token,
            "expires_at": invitation.expires_at
        }

    @staticmethod
    def accept_invitation(db: Session, token: str, user_id: int, ip_address: str = None) -> dict:
        """Accept workspace invitation."""
        ip_address = ip_address or "unknown"

        # Get invitation
        invitation = get_invitation_by_token(db, token)
        if not invitation:
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_INVITE_ACCEPT",
                result="failure",
                error_code="INVITATION_NOT_FOUND",
                ip_address=ip_address,
                user_id=user_id
            )
            raise ValueError("INVITATION_NOT_FOUND")

        # Check if expired
        if invitation.is_expired():
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_INVITE_ACCEPT",
                result="failure",
                error_code="INVITATION_EXPIRED",
                ip_address=ip_address,
                user_id=user_id
            )
            raise ValueError("INVITATION_EXPIRED")

        # Check if already accepted/rejected
        if invitation.is_accepted() or invitation.is_rejected():
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_INVITE_ACCEPT",
                result="failure",
                error_code="INVITATION_ALREADY_USED",
                ip_address=ip_address,
                user_id=user_id
            )
            raise ValueError("INVITATION_ALREADY_USED")

        # Get user
        user = get_user_by_id(db, user_id)
        if not user or user.email != invitation.email:
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_INVITE_ACCEPT",
                result="failure",
                error_code="INVITATION_NOT_FOUND",
                ip_address=ip_address,
                user_id=user_id
            )
            raise ValueError("INVITATION_NOT_FOUND")

        # Add user as member
        add_workspace_member(db, invitation.workspace_id, user_id, invitation.role)
        accept_invitation(db, invitation.id)

        create_audit_log(
            db,
            event_name="WS_AUDIT",
            action="event=WS_INVITE_ACCEPT",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Workspace",
            entity_ids=f"workspace_id={invitation.workspace_id}"
        )

        return {
            "workspace_id": invitation.workspace_id,
            "email": invitation.email,
            "role": invitation.role,
            "accepted_at": invitation.accepted_at
        }

    @staticmethod
    def update_member_role(
        db: Session,
        workspace_id: int,
        member_user_id: int,
        new_role: str,
        user_id: int,
        ip_address: str = None
    ) -> dict:
        """Update member role (OWNER only)."""
        ip_address = ip_address or "unknown"

        # Check owner permission
        owner_member = get_workspace_member(db, workspace_id, user_id)
        if not owner_member or owner_member.role != "OWNER":
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_MEMBER_UPDATE",
                result="failure",
                error_code="PERMISSION_DENIED",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Workspace",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise ValueError("PERMISSION_DENIED")

        # Cannot change owner role
        target_member = get_workspace_member(db, workspace_id, member_user_id)
        if target_member.role == "OWNER" and new_role != "OWNER":
            raise ValueError("UNSUPPORTED_OPERATION")

        # Update role
        updated_member = update_member_role(db, workspace_id, member_user_id, new_role)

        create_audit_log(
            db,
            event_name="WS_AUDIT",
            action="event=WS_MEMBER_UPDATE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Workspace",
            entity_ids=f"workspace_id={workspace_id}"
        )

        return {
            "user_id": updated_member.user_id,
            "role": updated_member.role
        }

    @staticmethod
    def remove_member(
        db: Session,
        workspace_id: int,
        member_user_id: int,
        user_id: int,
        ip_address: str = None
    ) -> dict:
        """Remove member from workspace (OWNER only)."""
        ip_address = ip_address or "unknown"

        # Check owner permission
        owner_member = get_workspace_member(db, workspace_id, user_id)
        if not owner_member or owner_member.role != "OWNER":
            create_audit_log(
                db,
                event_name="WS_AUDIT",
                action="event=WS_MEMBER_REMOVE",
                result="failure",
                error_code="PERMISSION_DENIED",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Workspace",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise ValueError("PERMISSION_DENIED")

        # Cannot remove owner
        target_member = get_workspace_member(db, workspace_id, member_user_id)
        if target_member and target_member.role == "OWNER":
            raise ValueError("UNSUPPORTED_OPERATION")

        # Remove member
        remove_workspace_member(db, workspace_id, member_user_id)

        create_audit_log(
            db,
            event_name="WS_AUDIT",
            action="event=WS_MEMBER_REMOVE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Workspace",
            entity_ids=f"workspace_id={workspace_id}"
        )

        return {"message": "Member removed"}
