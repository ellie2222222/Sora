"""
Seed local development accounts.

    admin@gmail.com  system administrator — no workspace, no workspace role
    user@gmail.com   standard user — OWNER of "Family Finances"

System administration is system-wide and sits outside the workspace role model
(SRS §1.5, CLAUDE.md AC-01), so the admin account is deliberately left without
any WorkspaceMember row.

The seeded password is deliberately weak and would be rejected by
POST /api/v1/auth/register (min 8 chars, Auth-US-01). This script writes
directly to the database and is for local development only.

Idempotent: re-running resets passwords, workspace ownership, and membership.

    docker compose exec backend python -m scripts.seed_dev_users

Running it as a plain path (`python scripts/seed_dev_users.py`) works too: Python puts
only `scripts/` on the import path in that mode, so the backend root is added below
before anything from `app` is imported.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import SessionLocal  # noqa: E402  (import follows the path bootstrap)
from app import models
from app.repositories import (
    get_password_hash,
    get_user_by_email,
    get_workspace_member,
)
from app.services.workspace_service import WorkspaceService

SEED_PASSWORD = "123"

ADMIN_EMAIL = "admin@gmail.com"
USER_EMAIL = "user@gmail.com"
WORKSPACE_NAME = "Family Finances"


def upsert_user(db, email: str, full_name: str) -> models.User:
    """Create the user, or reset an existing one back to the seeded state."""
    user = get_user_by_email(db, email)
    now = datetime.now(timezone.utc)

    if user:
        user.password_hash = get_password_hash(SEED_PASSWORD)
        user.full_name = full_name
        user.is_active = True
        user.email_verified = True
        user.email_verified_at = user.email_verified_at or now
        user.deleted_at = None
        action = "updated"
    else:
        user = models.User(
            email=email,
            password_hash=get_password_hash(SEED_PASSWORD),
            full_name=full_name,
            is_active=True,
            email_verified=True,
            email_verified_at=now,
        )
        db.add(user)
        action = "created"

    db.commit()
    db.refresh(user)
    print(f"  {action}: {email} (id={user.id})")
    return user


def strip_workspace_access(db, user: models.User) -> None:
    """Remove every workspace and membership belonging to the system admin."""
    owned = (
        db.query(models.Workspace)
        .filter(models.Workspace.owner_id == user.id)
        .all()
    )
    for workspace in owned:
        db.query(models.Category).filter(
            models.Category.workspace_id == workspace.id
        ).delete(synchronize_session=False)
        db.query(models.WorkspaceInvitation).filter(
            models.WorkspaceInvitation.workspace_id == workspace.id
        ).delete(synchronize_session=False)
        db.query(models.WorkspaceMember).filter(
            models.WorkspaceMember.workspace_id == workspace.id
        ).delete(synchronize_session=False)
        db.delete(workspace)
        print(f"  removed workspace owned by admin: {workspace.name} (id={workspace.id})")

    removed = (
        db.query(models.WorkspaceMember)
        .filter(models.WorkspaceMember.user_id == user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    if removed:
        print(f"  removed {removed} workspace membership(s) from {user.email}")


def ensure_owned_workspace(db, user: models.User) -> int:
    """Give the standard user a workspace they own, creating it if absent."""
    workspace = (
        db.query(models.Workspace)
        .filter(
            models.Workspace.owner_id == user.id,
            models.Workspace.name == WORKSPACE_NAME,
            models.Workspace.deleted_at.is_(None),
        )
        .first()
    )

    if workspace:
        print(f"  reused workspace: {WORKSPACE_NAME} (id={workspace.id})")
        workspace_id = workspace.id
    else:
        # create_workspace also registers the creator as OWNER and seeds categories.
        created = WorkspaceService.create_workspace(
            db,
            user.id,
            WORKSPACE_NAME,
            description="Seeded workspace for local development",
            currency="USD",
            ip_address="127.0.0.1",
        )
        workspace_id = created["id"]
        print(f"  created workspace: {WORKSPACE_NAME} (id={workspace_id})")

    member = get_workspace_member(db, workspace_id, user.id)
    if member is None:
        db.add(
            models.WorkspaceMember(
                workspace_id=workspace_id,
                user_id=user.id,
                role="OWNER",
            )
        )
        db.commit()
        print(f"  member added: {user.email} as OWNER")
    elif member.role != "OWNER":
        member.role = "OWNER"
        db.commit()
        print(f"  member role set: {user.email} -> OWNER")
    else:
        print(f"  member ok: {user.email} is OWNER")

    return workspace_id


def main() -> int:
    db = SessionLocal()
    try:
        print("Seeding development users...")

        admin = upsert_user(db, ADMIN_EMAIL, "System Administrator")
        strip_workspace_access(db, admin)

        user = upsert_user(db, USER_EMAIL, "Regular User")
        ensure_owned_workspace(db, user)

        print(f"\nDone. Password for both accounts: {SEED_PASSWORD}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
