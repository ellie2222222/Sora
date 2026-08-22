"""ACC-US-01 … ACC-US-04: workspace account management."""

import logging
from decimal import Decimal
from sqlalchemy.orm import Session

from app.repositories import (
    archive_account,
    create_account,
    create_audit_log,
    get_account,
    get_account_by_name,
    get_workspace,
    list_workspace_accounts,
    update_account,
)
from app.services.access import require_membership, require_owner
from app.services.currency import normalise_currency
from app.services.exchange_rate_service import snapshot_rate

logger = logging.getLogger(__name__)

EVENT = "ACCOUNT_AUDIT"


def _to_dict(account) -> dict:
    return {
        "id": account.id,
        "workspace_id": account.workspace_id,
        "type": account.type,
        "name": account.name,
        "currency": account.currency,
        "exchange_rate": account.exchange_rate,
        "opening_base_balance": account.opening_base_balance,
        "balance": account.balance,
        "opening_balance": account.opening_balance,
        "institution": account.institution,
        "account_number": account.account_number,
        "color": account.color,
        "icon": account.icon,
        "status": "archived" if account.deleted_at is not None else "active",
        "created_at": account.created_at,
    }


class AccountService:
    @staticmethod
    def create_account(
        db: Session,
        workspace_id: int,
        user_id: int,
        type: str,
        name: str,
        currency: str,
        opening_balance: Decimal = Decimal("0"),
        institution: str = None,
        account_number: str = None,
        color: str = None,
        icon: str = None,
        ip_address: str = None
    ) -> dict:
        """
        Any member may add an account; balance starts at the opening balance.

        The opening balance carries its own snapshot rate to the workspace
        preferred currency — fetched here, never supplied by the caller — so a
        foreign-currency account contributes a fixed base amount to the total
        balance (BR-07).
        """
        ip_address = ip_address or "unknown"
        require_membership(db, workspace_id, user_id, EVENT, "event=ACCOUNT_CREATE", ip_address)

        workspace = get_workspace(db, workspace_id)
        try:
            code = normalise_currency(currency)
            rate = snapshot_rate(workspace.currency, code)
        except ValueError as error:
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=ACCOUNT_CREATE",
                result="failure",
                error_code=str(error),
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Account",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise

        if get_account_by_name(db, workspace_id, name):
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=ACCOUNT_CREATE",
                result="failure",
                error_code="ACCOUNT_NAME_EXISTS",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Account",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise ValueError("ACCOUNT_NAME_EXISTS")

        account = create_account(
            db,
            workspace_id,
            type,
            name,
            code,
            opening_balance,
            institution,
            account_number,
            color,
            icon,
            exchange_rate=rate
        )
        logger.info(f"[ACCOUNT] Created account id={account.id} in workspace {workspace_id}")

        create_audit_log(
            db,
            event_name=EVENT,
            action="event=ACCOUNT_CREATE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Account",
            entity_ids=f"account_id={account.id} workspace_id={workspace_id}"
        )
        return _to_dict(account)

    @staticmethod
    def list_accounts(
        db: Session,
        workspace_id: int,
        user_id: int,
        status: str = None,
        page: int = 1,
        page_size: int = 25,
        ip_address: str = None
    ) -> dict:
        require_membership(db, workspace_id, user_id, EVENT, "event=ACCOUNT_LIST", ip_address)
        accounts, total = list_workspace_accounts(db, workspace_id, status, page, page_size)
        return {
            "accounts": [_to_dict(a) for a in accounts],
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": page * page_size < total,
        }

    @staticmethod
    def get_account(
        db: Session,
        workspace_id: int,
        account_id: int,
        user_id: int,
        ip_address: str = None
    ) -> dict:
        ip_address = ip_address or "unknown"
        require_membership(db, workspace_id, user_id, EVENT, "event=ACCOUNT_GET", ip_address)

        account = get_account(db, account_id)
        if not account or account.workspace_id != workspace_id:
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=ACCOUNT_GET",
                result="failure",
                error_code="ACCOUNT_NOT_FOUND",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Account",
                entity_ids=f"account_id={account_id} workspace_id={workspace_id}"
            )
            raise ValueError("ACCOUNT_NOT_FOUND")

        return _to_dict(account)

    @staticmethod
    def update_account(
        db: Session,
        workspace_id: int,
        account_id: int,
        user_id: int,
        name: str = None,
        institution: str = None,
        account_number: str = None,
        color: str = None,
        icon: str = None,
        ip_address: str = None
    ) -> dict:
        """
        OWNER only (SDS §5.4). Type, opening balance and currency cannot change.

        Currency is immutable because the balance, the opening balance and the
        opening snapshot rate are all denominated in it and none can be restated:
        relabelling a VND account as USD would silently multiply it by ~26,000.
        To report in a different currency, change the workspace preferred currency
        instead — that re-snapshots the rates rather than the amounts.
        """
        ip_address = ip_address or "unknown"
        require_owner(db, workspace_id, user_id, EVENT, "event=ACCOUNT_UPDATE", ip_address)

        account = get_account(db, account_id)
        if not account or account.workspace_id != workspace_id:
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=ACCOUNT_UPDATE",
                result="failure",
                error_code="ACCOUNT_NOT_FOUND",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Account",
                entity_ids=f"account_id={account_id} workspace_id={workspace_id}"
            )
            raise ValueError("ACCOUNT_NOT_FOUND")

        if account.deleted_at is not None:
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=ACCOUNT_UPDATE",
                result="failure",
                error_code="ACCOUNT_ARCHIVED",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Account",
                entity_ids=f"account_id={account_id} workspace_id={workspace_id}"
            )
            raise ValueError("ACCOUNT_ARCHIVED")

        if name and name.lower() != account.name.lower():
            existing = get_account_by_name(db, workspace_id, name)
            if existing and existing.id != account_id:
                create_audit_log(
                    db,
                    event_name=EVENT,
                    action="event=ACCOUNT_UPDATE",
                    result="failure",
                    error_code="ACCOUNT_NAME_EXISTS",
                    ip_address=ip_address,
                    user_id=user_id,
                    entity_type="Account",
                    entity_ids=f"account_id={account_id} workspace_id={workspace_id}"
                )
                raise ValueError("ACCOUNT_NAME_EXISTS")

        old_name = account.name
        updated = update_account(
            db,
            account_id,
            name,
            institution,
            account_number,
            color,
            icon
        )

        create_audit_log(
            db,
            event_name=EVENT,
            action="event=ACCOUNT_UPDATE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Account",
            entity_ids=f"account_id={account_id} workspace_id={workspace_id}",
            details=f"old_name={old_name} new_name={updated.name}" if name else None
        )
        return _to_dict(updated)

    @staticmethod
    def archive_account(
        db: Session,
        workspace_id: int,
        account_id: int,
        user_id: int,
        ip_address: str = None
    ) -> dict:
        """
        ACC-US-04: archiving is the soft-delete. History is preserved and the
        account stops appearing in transaction pickers. Cannot be un-archived.
        """
        ip_address = ip_address or "unknown"
        require_owner(db, workspace_id, user_id, EVENT, "event=ACCOUNT_ARCHIVE", ip_address)

        account = get_account(db, account_id)
        if not account or account.workspace_id != workspace_id:
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=ACCOUNT_ARCHIVE",
                result="failure",
                error_code="ACCOUNT_NOT_FOUND",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Account",
                entity_ids=f"account_id={account_id} workspace_id={workspace_id}"
            )
            raise ValueError("ACCOUNT_NOT_FOUND")

        if account.deleted_at is not None:
            raise ValueError("ACCOUNT_ARCHIVED")

        archived = archive_account(db, account_id)
        logger.info(f"[ACCOUNT] Archived account id={account_id}")

        create_audit_log(
            db,
            event_name=EVENT,
            action="event=ACCOUNT_ARCHIVE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Account",
            entity_ids=f"account_id={account_id} workspace_id={workspace_id}"
        )
        return _to_dict(archived)
