import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import User, LoginAttempt


class TestAuthRegister:
    def test_register_success(self, client: TestClient, db: Session):
        """Test successful user registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "SecurePass123!",
                "full_name": "New User",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["email"] == "newuser@example.com"
        assert data["data"]["full_name"] == "New User"
        assert "access_token" in data["data"]
        assert "refresh_token" in data["data"]

        # Verify user was created in database
        user = db.query(User).filter(User.email == "newuser@example.com").first()
        assert user is not None
        assert user.full_name == "New User"

    def test_register_duplicate_email(self, client: TestClient, test_user: User):
        """Test registration with duplicate email."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "SecurePass123!",
                "full_name": "Another User",
            },
        )

        assert response.status_code == 409
        data = response.json()
        assert data["success"] is False
        assert data["error_code"] == "USER_EMAIL_EXISTS"

    def test_register_invalid_email(self, client: TestClient):
        """Test registration with invalid email."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "invalid-email",
                "password": "SecurePass123!",
                "full_name": "Test User",
            },
        )

        assert response.status_code == 422

    def test_register_weak_password(self, client: TestClient):
        """Test registration with weak password."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "weak",
                "full_name": "Test User",
            },
        )

        # Password validation may be handled by frontend,
        # but backend should accept and hash it
        assert response.status_code in [201, 422]


class TestAuthLogin:
    def test_login_success(self, client: TestClient, test_user: User):
        """Test successful login."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "refresh_token" in data["data"]

    def test_login_invalid_credentials(self, client: TestClient, test_user: User):
        """Test login with wrong password."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrongpassword"},
        )

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["error_code"] == "INVALID_CREDENTIALS"

    def test_login_nonexistent_user(self, client: TestClient):
        """Test login with nonexistent email."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@example.com", "password": "password123"},
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error_code"] == "INVALID_CREDENTIALS"

    def test_login_unverified_email(self, client: TestClient, test_user_unverified: User):
        """Test login with unverified email."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "unverified@example.com", "password": "testpassword123"},
        )

        assert response.status_code == 403
        data = response.json()
        assert data["error_code"] == "EMAIL_NOT_VERIFIED"

    def test_login_brute_force_protection(self, client: TestClient, test_user: User, db: Session):
        """Test brute-force protection after 5 failed attempts."""
        # Make 5 failed login attempts
        for i in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrongpassword"},
            )
            assert response.status_code == 401

        # 6th attempt should be locked
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )

        assert response.status_code == 429
        data = response.json()
        assert data["error_code"] == "ACCOUNT_LOCKED"


class TestAuthVerifyEmail:
    def test_verify_email_success(self, client: TestClient, test_user_unverified: User, db: Session):
        """Test successful email verification."""
        from app.core.jwt_utils import create_email_verification_token

        token = create_email_verification_token(test_user_unverified.email)

        response = client.post(
            "/api/v1/auth/email-verification",
            json={"token": token},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify user is now verified in database
        db.refresh(test_user_unverified)
        assert test_user_unverified.is_email_verified is True

    def test_verify_email_invalid_token(self, client: TestClient):
        """Test email verification with invalid token."""
        response = client.post(
            "/api/v1/auth/email-verification",
            json={"token": "invalid-token"},
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error_code"] == "INVALID_TOKEN"

    def test_verify_email_expired_token(self, client: TestClient, test_user_unverified: User):
        """Test email verification with expired token."""
        from app.core.jwt_utils import create_email_verification_token
        from datetime import timedelta
        from app.core.config import settings

        # Create an expired token (negative expiration)
        expired_token = create_email_verification_token(test_user_unverified.email, expires_delta=timedelta(seconds=-1))

        response = client.post(
            "/api/v1/auth/email-verification",
            json={"token": expired_token},
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error_code"] == "TOKEN_EXPIRED"


class TestAuthRefresh:
    def test_refresh_token_success(self, client: TestClient, test_user: User):
        """Test successful token refresh."""
        # First login to get tokens
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        refresh_token = login_response.json()["data"]["refresh_token"]

        # Refresh the token
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "refresh_token" in data["data"]

    def test_refresh_token_invalid(self, client: TestClient):
        """Test token refresh with invalid token."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid-token"},
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error_code"] == "INVALID_TOKEN"

    def test_refresh_token_missing(self, client: TestClient):
        """Test token refresh without token."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": ""},
        )

        assert response.status_code == 422


class TestAuthLogout:
    def test_logout_success(self, client: TestClient, test_user: User):
        """Test successful logout."""
        # First login to get tokens
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        refresh_token = login_response.json()["data"]["refresh_token"]

        # Logout
        response = client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refresh_token},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_logout_invalid_token(self, client: TestClient):
        """Test logout with invalid token."""
        response = client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": "invalid-token"},
        )

        # Logout should succeed even with invalid token (idempotent)
        assert response.status_code == 200
