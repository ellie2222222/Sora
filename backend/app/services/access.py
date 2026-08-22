"""Workspace access checks shared by the workspace-scoped services (AC-02, AC-03)."""

from sqlalchemy.orm import Session

from app.repositories import create_audit_log, get_workspace, get_workspace_member


def require_membership(
    db: Session,
    workspace_id: int,
    user_id: int,
    event_name: str,
    action: str,
    ip_address: str = None
):
    """
    Returns the caller's WorkspaceMember row, or raises.

    Raises ValueError('WORKSPACE_NOT_FOUND') when the workspace is gone and
    ValueError('PERMISSION_DENIED') when the caller is not a member. Both outcomes
    are audit-logged as failures (LA-03).
    """
    ip_address = ip_address or "unknown"

    workspace = get_workspace(db, workspace_id)
    if not workspace:
        create_audit_log(
            db,
            event_name=event_name,
            action=action,
            result="failure",
            error_code="WORKSPACE_NOT_FOUND",
            ip_address=ip_address,
            user_id=user_id
        )
        raise ValueError("WORKSPACE_NOT_FOUND")

    member = get_workspace_member(db, workspace_id, user_id)
    if not member:
        create_audit_log(
            db,
            event_name=event_name,
            action=action,
            result="failure",
            error_code="PERMISSION_DENIED",
            ip_address=ip_address,
            user_id=user_id,
            entity_ids=f"workspace_id={workspace_id}"
        )
        raise ValueError("PERMISSION_DENIED")

    return member


def require_owner(
    db: Session,
    workspace_id: int,
    user_id: int,
    event_name: str,
    action: str,
    ip_address: str = None
):
    """Membership plus the OWNER role; raises ValueError('PERMISSION_DENIED') otherwise."""
    member = require_membership(db, workspace_id, user_id, event_name, action, ip_address)

    if member.role != "OWNER":
        create_audit_log(
            db,
            event_name=event_name,
            action=action,
            result="failure",
            error_code="PERMISSION_DENIED",
            ip_address=ip_address or "unknown",
            user_id=user_id,
            entity_ids=f"workspace_id={workspace_id}"
        )
        raise ValueError("PERMISSION_DENIED")

    return member
