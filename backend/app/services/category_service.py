"""CAT-US-01: workspace category management."""

import logging
from sqlalchemy.orm import Session

from app.repositories import (
    count_active_transactions_for_category,
    create_audit_log,
    create_category,
    delete_category,
    get_category,
    get_category_by_name,
    list_workspace_categories,
    update_category,
)
from app.services.access import require_membership, require_owner

logger = logging.getLogger(__name__)

EVENT = "CATEGORY_AUDIT"


def _to_dict(category) -> dict:
    return {
        "id": category.id,
        "workspace_id": category.workspace_id,
        "name": category.name,
        "type": category.type,
        "color": category.color,
        "icon": category.icon,
        "is_default": bool(category.is_default),
        "is_archived": category.deleted_at is not None,
        "created_at": category.created_at,
    }


class CategoryService:
    @staticmethod
    def list_categories(
        db: Session,
        workspace_id: int,
        user_id: int,
        type: str = None,
        include_archived: bool = False,
        ip_address: str = None
    ) -> list:
        """Readable by every workspace member (SDS §4.8)."""
        require_membership(db, workspace_id, user_id, EVENT, "event=CATEGORY_LIST", ip_address)
        categories = list_workspace_categories(db, workspace_id, type, include_archived)
        return [_to_dict(c) for c in categories]

    @staticmethod
    def create_category(
        db: Session,
        workspace_id: int,
        user_id: int,
        name: str,
        type: str,
        color: str = None,
        icon: str = None,
        ip_address: str = None
    ) -> dict:
        ip_address = ip_address or "unknown"
        require_owner(db, workspace_id, user_id, EVENT, "event=CATEGORY_CREATE", ip_address)

        if get_category_by_name(db, workspace_id, name):
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=CATEGORY_CREATE",
                result="failure",
                error_code="CATEGORY_NAME_EXISTS",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Category",
                entity_ids=f"workspace_id={workspace_id}"
            )
            raise ValueError("CATEGORY_NAME_EXISTS")

        category = create_category(db, workspace_id, name, type, color, icon)
        logger.info(f"[CATEGORY] Created category id={category.id} in workspace {workspace_id}")

        create_audit_log(
            db,
            event_name=EVENT,
            action="event=CATEGORY_CREATE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Category",
            entity_ids=f"category_id={category.id} workspace_id={workspace_id}"
        )
        return _to_dict(category)

    @staticmethod
    def update_category(
        db: Session,
        workspace_id: int,
        category_id: int,
        user_id: int,
        name: str = None,
        color: str = None,
        icon: str = None,
        ip_address: str = None
    ) -> dict:
        """Type is fixed at creation — a category cannot flip between income and expense."""
        ip_address = ip_address or "unknown"
        require_owner(db, workspace_id, user_id, EVENT, "event=CATEGORY_UPDATE", ip_address)

        category = get_category(db, category_id)
        if not category or category.workspace_id != workspace_id:
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=CATEGORY_UPDATE",
                result="failure",
                error_code="CATEGORY_NOT_FOUND",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Category",
                entity_ids=f"category_id={category_id} workspace_id={workspace_id}"
            )
            raise ValueError("CATEGORY_NOT_FOUND")

        if name and name.lower() != category.name.lower():
            existing = get_category_by_name(db, workspace_id, name)
            if existing and existing.id != category_id:
                create_audit_log(
                    db,
                    event_name=EVENT,
                    action="event=CATEGORY_UPDATE",
                    result="failure",
                    error_code="CATEGORY_NAME_EXISTS",
                    ip_address=ip_address,
                    user_id=user_id,
                    entity_type="Category",
                    entity_ids=f"category_id={category_id} workspace_id={workspace_id}"
                )
                raise ValueError("CATEGORY_NAME_EXISTS")

        old_name = category.name
        updated = update_category(db, category_id, name, color, icon)

        create_audit_log(
            db,
            event_name=EVENT,
            action="event=CATEGORY_UPDATE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Category",
            entity_ids=f"category_id={category_id} workspace_id={workspace_id}",
            details=f"old_name={old_name} new_name={updated.name}" if name else None
        )
        return _to_dict(updated)

    @staticmethod
    def archive_category(
        db: Session,
        workspace_id: int,
        category_id: int,
        user_id: int,
        ip_address: str = None
    ) -> dict:
        """
        Soft-delete. Archived categories stay on existing transactions but are
        no longer selectable for new ones (CAT-US-01).
        """
        ip_address = ip_address or "unknown"
        require_owner(db, workspace_id, user_id, EVENT, "event=CATEGORY_ARCHIVE", ip_address)

        category = get_category(db, category_id)
        if not category or category.workspace_id != workspace_id:
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=CATEGORY_ARCHIVE",
                result="failure",
                error_code="CATEGORY_NOT_FOUND",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Category",
                entity_ids=f"category_id={category_id} workspace_id={workspace_id}"
            )
            raise ValueError("CATEGORY_NOT_FOUND")

        if count_active_transactions_for_category(db, category_id) > 0:
            create_audit_log(
                db,
                event_name=EVENT,
                action="event=CATEGORY_ARCHIVE",
                result="failure",
                error_code="CATEGORY_IN_USE",
                ip_address=ip_address,
                user_id=user_id,
                entity_type="Category",
                entity_ids=f"category_id={category_id} workspace_id={workspace_id}"
            )
            raise ValueError("CATEGORY_IN_USE")

        archived = delete_category(db, category_id)
        logger.info(f"[CATEGORY] Archived category id={category_id}")

        create_audit_log(
            db,
            event_name=EVENT,
            action="event=CATEGORY_ARCHIVE",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="Category",
            entity_ids=f"category_id={category_id} workspace_id={workspace_id}"
        )
        return _to_dict(archived)
