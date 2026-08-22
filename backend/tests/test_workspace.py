import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import User, Workspace, WorkspaceMember, WorkspaceInvitation


class TestWorkspaceCreate:
    def test_create_workspace_success(self, client: TestClient, auth_headers: dict, test_user: User, db: Session):
        """Test successful workspace creation."""
        response = client.post(
            "/api/v1/workspaces",
            json={
                "name": "My Finance Workspace",
                "description": "Personal finance tracking",
                "currency": "USD",
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "My Finance Workspace"
        assert data["data"]["currency"] == "USD"

        # Verify workspace was created with owner
        workspace_id = data["data"]["id"]
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        assert workspace is not None
        assert workspace.owner_id == test_user.id

        # Verify owner member was added
        member = (
            db.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == test_user.id,
            )
            .first()
        )
        assert member is not None
        assert member.role == "OWNER"

        # Verify default categories were created
        from app.models import Category

        categories = db.query(Category).filter(Category.workspace_id == workspace_id).all()
        assert len(categories) == 15

    def test_create_workspace_unauthorized(self, client: TestClient):
        """Test workspace creation without authentication."""
        response = client.post(
            "/api/v1/workspaces",
            json={
                "name": "My Workspace",
                "currency": "USD",
            },
        )

        assert response.status_code == 401

    def test_create_workspace_invalid_currency(self, client: TestClient, auth_headers: dict):
        """Test workspace creation with invalid currency."""
        response = client.post(
            "/api/v1/workspaces",
            json={
                "name": "My Workspace",
                "currency": "",  # Empty currency
            },
            headers=auth_headers,
        )

        assert response.status_code == 422


class TestWorkspaceList:
    def test_list_workspaces(self, client: TestClient, auth_headers: dict, test_user: User, db: Session):
        """Test listing user's workspaces."""
        # Create 2 workspaces
        for i in range(2):
            workspace = Workspace(
                owner_id=test_user.id,
                name=f"Workspace {i+1}",
                currency="USD",
            )
            db.add(workspace)
            db.commit()

            # Add owner as member
            member = WorkspaceMember(
                workspace_id=workspace.id,
                user_id=test_user.id,
                role="OWNER",
            )
            db.add(member)
            db.commit()

        response = client.get("/api/v1/workspaces", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]["workspaces"]) == 2

    def test_list_workspaces_empty(self, client: TestClient, auth_headers: dict):
        """Test listing workspaces when none exist."""
        response = client.get("/api/v1/workspaces", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]["workspaces"]) == 0

    def test_list_workspaces_unauthorized(self, client: TestClient):
        """Test listing workspaces without authentication."""
        response = client.get("/api/v1/workspaces")

        assert response.status_code == 401


class TestWorkspaceGet:
    def test_get_workspace_success(self, client: TestClient, auth_headers: dict, test_user: User, db: Session):
        """Test getting workspace details."""
        workspace = Workspace(
            owner_id=test_user.id,
            name="My Workspace",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user.id,
            role="OWNER",
        )
        db.add(member)
        db.commit()

        response = client.get(f"/api/v1/workspaces/{workspace.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "My Workspace"
        assert data["data"]["user_role"] == "OWNER"

    def test_get_workspace_not_found(self, client: TestClient, auth_headers: dict):
        """Test getting nonexistent workspace."""
        response = client.get("/api/v1/workspaces/9999", headers=auth_headers)

        assert response.status_code == 404
        data = response.json()
        assert data["error_code"] == "WORKSPACE_NOT_FOUND"

    def test_get_workspace_forbidden(self, client: TestClient, test_user: User, db: Session):
        """Test getting workspace without access."""
        # Create another user
        other_user = User(
            email="other@example.com",
            hashed_password="hashed",
            is_email_verified=True,
        )
        db.add(other_user)
        db.commit()

        # Create workspace for other user
        workspace = Workspace(
            owner_id=other_user.id,
            name="Other Workspace",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        # Login as test user
        from app.core.jwt_utils import create_access_token

        access_token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.get(f"/api/v1/workspaces/{workspace.id}", headers=headers)

        assert response.status_code == 403


class TestWorkspaceUpdate:
    def test_update_workspace_success(self, client: TestClient, auth_headers: dict, test_user: User, db: Session):
        """Test successful workspace update."""
        workspace = Workspace(
            owner_id=test_user.id,
            name="Original Name",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user.id,
            role="OWNER",
        )
        db.add(member)
        db.commit()

        response = client.put(
            f"/api/v1/workspaces/{workspace.id}",
            json={
                "name": "Updated Name",
                "currency": "EUR",
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "Updated Name"
        assert data["data"]["currency"] == "EUR"

    def test_update_workspace_unauthorized(self, client: TestClient, test_user: User, db: Session):
        """Test workspace update without permission."""
        workspace = Workspace(
            owner_id=test_user.id,
            name="Original Name",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        # Create another user without workspace access
        other_user = User(
            email="other@example.com",
            hashed_password="hashed",
            is_email_verified=True,
        )
        db.add(other_user)
        db.commit()

        from app.core.jwt_utils import create_access_token

        access_token = create_access_token(other_user.id)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.put(
            f"/api/v1/workspaces/{workspace.id}",
            json={"name": "New Name"},
            headers=headers,
        )

        assert response.status_code == 403


class TestWorkspaceDelete:
    def test_delete_workspace_success(self, client: TestClient, auth_headers: dict, test_user: User, db: Session):
        """Test successful workspace deletion (soft delete)."""
        workspace = Workspace(
            owner_id=test_user.id,
            name="To Delete",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user.id,
            role="OWNER",
        )
        db.add(member)
        db.commit()

        workspace_id = workspace.id

        response = client.delete(
            f"/api/v1/workspaces/{workspace_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify soft delete (deleted_at is set)
        db.refresh(workspace)
        assert workspace.deleted_at is not None


class TestWorkspaceMembers:
    def test_invite_member_success(self, client: TestClient, auth_headers: dict, test_user: User, db: Session):
        """Test successful member invitation."""
        workspace = Workspace(
            owner_id=test_user.id,
            name="My Workspace",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user.id,
            role="OWNER",
        )
        db.add(member)
        db.commit()

        response = client.post(
            f"/api/v1/workspaces/{workspace.id}/members/invite",
            json={"email": "invitee@example.com", "role": "MEMBER"},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["email"] == "invitee@example.com"

        # Verify invitation was created
        invitation = (
            db.query(WorkspaceInvitation)
            .filter(WorkspaceInvitation.workspace_id == workspace.id)
            .first()
        )
        assert invitation is not None
        assert invitation.email == "invitee@example.com"

    def test_invite_member_not_owner(self, client: TestClient, test_user: User, db: Session):
        """Test member invitation without OWNER role."""
        workspace = Workspace(
            owner_id=test_user.id,
            name="My Workspace",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        # Add test user as MEMBER (not OWNER)
        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user.id,
            role="MEMBER",
        )
        db.add(member)
        db.commit()

        from app.core.jwt_utils import create_access_token

        access_token = create_access_token(test_user.id)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            f"/api/v1/workspaces/{workspace.id}/members/invite",
            json={"email": "invitee@example.com", "role": "MEMBER"},
            headers=headers,
        )

        assert response.status_code == 403

    def test_accept_invitation_success(self, client: TestClient, test_user: User, db: Session):
        """Test successful invitation acceptance."""
        workspace = Workspace(
            owner_id=test_user.id,
            name="My Workspace",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        owner_member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user.id,
            role="OWNER",
        )
        db.add(owner_member)
        db.commit()

        # Create invitation
        from app.core.jwt_utils import create_invitation_token

        invitee_email = "invitee@example.com"
        token = create_invitation_token(workspace.id, invitee_email)

        invitation = WorkspaceInvitation(
            workspace_id=workspace.id,
            email=invitee_email,
            role="MEMBER",
            token=token,
            created_by=test_user.id,
        )
        db.add(invitation)
        db.commit()

        # Create invitee user
        invitee = User(
            email=invitee_email,
            hashed_password="hashed",
            is_email_verified=True,
        )
        db.add(invitee)
        db.commit()

        from app.core.jwt_utils import create_access_token

        access_token = create_access_token(invitee.id)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            "/api/v1/invitations/accept",
            json={"token": token},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify user is now member
        new_member = (
            db.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == workspace.id,
                WorkspaceMember.user_id == invitee.id,
            )
            .first()
        )
        assert new_member is not None
        assert new_member.role == "MEMBER"

    def test_update_member_role_success(self, client: TestClient, auth_headers: dict, test_user: User, db: Session):
        """Test successful member role update."""
        workspace = Workspace(
            owner_id=test_user.id,
            name="My Workspace",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        owner = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user.id,
            role="OWNER",
        )
        db.add(owner)
        db.commit()

        # Create another member
        other_user = User(
            email="other@example.com",
            hashed_password="hashed",
            is_email_verified=True,
        )
        db.add(other_user)
        db.commit()

        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=other_user.id,
            role="MEMBER",
        )
        db.add(member)
        db.commit()

        response = client.put(
            f"/api/v1/workspaces/{workspace.id}/members/{other_user.id}/role",
            json={"role": "OWNER"},
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify role was updated
        db.refresh(member)
        assert member.role == "OWNER"

    def test_remove_member_success(self, client: TestClient, auth_headers: dict, test_user: User, db: Session):
        """Test successful member removal."""
        workspace = Workspace(
            owner_id=test_user.id,
            name="My Workspace",
            currency="USD",
        )
        db.add(workspace)
        db.commit()

        owner = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user.id,
            role="OWNER",
        )
        db.add(owner)
        db.commit()

        # Create another member
        other_user = User(
            email="other@example.com",
            hashed_password="hashed",
            is_email_verified=True,
        )
        db.add(other_user)
        db.commit()

        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=other_user.id,
            role="MEMBER",
        )
        db.add(member)
        db.commit()

        response = client.delete(
            f"/api/v1/workspaces/{workspace.id}/members/{other_user.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify member was removed
        remaining_member = (
            db.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == workspace.id,
                WorkspaceMember.user_id == other_user.id,
            )
            .first()
        )
        assert remaining_member is None
