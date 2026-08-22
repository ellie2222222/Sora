from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timezone
import logging
from app.repositories import (
    get_user_by_email, create_user, create_email_verification_token,
    get_email_verification_token, mark_email_verification_token_used,
    verify_password, create_login_attempt, get_recent_failed_login_attempts,
    create_refresh_token, get_refresh_token, revoke_refresh_token,
    create_audit_log, get_user_by_id, update_user_email_verified
)
from app.core.jwt_utils import (
    generate_tokens,
    create_email_verification_token as create_email_token,
    get_refresh_token_expiration,
    get_email_verification_token_expiration,
    verify_access_token
)
from app.core.config import settings
from app import models
from .email_service import EmailService

logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def register_user(
        db: Session,
        email: str,
        password: str,
        full_name: str = None,
        ip_address: str = None
    ) -> dict:
        """Register a new user and send verification email."""
        # Check if user already exists
        existing_user = get_user_by_email(db, email)
        if existing_user and not existing_user.is_deleted():
            # Log auth event
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_REGISTER",
                result="failure",
                error_code="USER_EMAIL_EXISTS",
                ip_address=ip_address or "unknown"
            )
            raise ValueError("USER_EMAIL_EXISTS")

        # Create user
        logger.info(f"[AUTH] Creating user account for {email}")
        user = create_user(db, email, password, full_name)
        logger.info(f"[AUTH] ✓ User created: id={user.id}, email={email}")

        # Generate email verification token
        logger.info(f"[AUTH] Generating email verification token for {email}")
        token = create_email_token()
        expires_at = get_email_verification_token_expiration()
        create_email_verification_token(db, user.id, token, expires_at)
        logger.info(f"[AUTH] ✓ Verification token created for user {user.id}")

        # Send verification email
        logger.info(f"[AUTH] Attempting to send verification email to {email}")
        email_sent = EmailService.send_verification_email(email, token, full_name)
        if email_sent:
            logger.info(f"[AUTH] ✓ Verification email sent to {email}")
        else:
            logger.warning(f"[AUTH] ⚠ Email sending failed for {email}, but user registration succeeded")

        # Log success
        create_audit_log(
            db,
            event_name="AUTH_AUDIT",
            action="event=AUTH_REGISTER",
            result="success",
            ip_address=ip_address or "unknown",
            user_id=user.id,
            entity_type="User",
            entity_ids=f"user_id={user.id}"
        )
        logger.info(f"[AUTH] ✓ Registration complete for {email}")

        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "email_verified": False,
            "created_at": user.created_at,
            "verification_token": token,
            "email_sent": email_sent
        }

    @staticmethod
    def login_user(db: Session, email: str, password: str, ip_address: str = None) -> dict:
        """Authenticate user and generate tokens."""
        ip_address = ip_address or "unknown"

        # Resolve the account first. The lockout counter exists to protect a real
        # account from being brute-forced; an address with no account behind it has
        # nothing to protect, so it is neither counted nor locked out.
        user = get_user_by_email(db, email)
        if not user:
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_LOGIN",
                result="failure",
                error_code="USER_NOT_FOUND",
                ip_address=ip_address
            )
            raise ValueError("USER_NOT_FOUND")

        # Check for brute force attempts against this account
        failed_attempts = get_recent_failed_login_attempts(
            db, email, minutes=settings.LOCKOUT_DURATION_MINUTES
        )
        if len(failed_attempts) >= settings.MAX_LOGIN_ATTEMPTS:
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_LOGIN",
                result="failure",
                error_code="ACCOUNT_LOCKED",
                ip_address=ip_address,
                user_id=user.id
            )
            raise ValueError("ACCOUNT_LOCKED")

        # Verify password
        if not verify_password(password, user.password_hash):
            create_login_attempt(db, email, False, ip_address)
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_LOGIN",
                result="failure",
                error_code="INVALID_CREDENTIALS",
                ip_address=ip_address,
                user_id=user.id
            )
            raise ValueError("INVALID_CREDENTIALS")

        # Check if email is verified
        if not user.email_verified:
            create_login_attempt(db, email, False, ip_address)
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_LOGIN",
                result="failure",
                error_code="EMAIL_NOT_VERIFIED",
                ip_address=ip_address,
                user_id=user.id
            )
            raise ValueError("EMAIL_NOT_VERIFIED")

        # Log successful attempt
        create_login_attempt(db, email, True, ip_address)

        # Generate tokens
        tokens = generate_tokens(user.id, user.email)
        refresh_token_expires = get_refresh_token_expiration()

        # Store refresh token
        create_refresh_token(
            db,
            user.id,
            tokens["refresh_token"],
            refresh_token_expires
        )

        # Log success
        create_audit_log(
            db,
            event_name="AUTH_AUDIT",
            action="event=AUTH_LOGIN",
            result="success",
            ip_address=ip_address,
            user_id=user.id,
            entity_type="User",
            entity_ids=f"user_id={user.id}"
        )

        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name
            }
        }

    @staticmethod
    def verify_email(db: Session, token: str, ip_address: str = None) -> dict:
        """Verify user email via token."""
        ip_address = ip_address or "unknown"

        # Get token
        db_token = get_email_verification_token(db, token)
        if not db_token:
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_EMAIL_VERIFY",
                result="failure",
                error_code="INVALID_TOKEN",
                ip_address=ip_address
            )
            raise ValueError("INVALID_TOKEN")

        # Check if already used
        if db_token.is_used():
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_EMAIL_VERIFY",
                result="failure",
                error_code="TOKEN_ALREADY_USED",
                ip_address=ip_address,
                user_id=db_token.user_id
            )
            raise ValueError("TOKEN_ALREADY_USED")

        # Check if expired
        if db_token.is_expired():
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_EMAIL_VERIFY",
                result="failure",
                error_code="TOKEN_EXPIRED",
                ip_address=ip_address,
                user_id=db_token.user_id
            )
            raise ValueError("TOKEN_EXPIRED")

        # Update user
        user = update_user_email_verified(db, db_token.user_id)
        mark_email_verification_token_used(db, db_token.id)

        create_audit_log(
            db,
            event_name="AUTH_AUDIT",
            action="event=AUTH_EMAIL_VERIFY",
            result="success",
            ip_address=ip_address,
            user_id=user.id,
            entity_type="User",
            entity_ids=f"user_id={user.id}"
        )

        return {
            "email": user.email,
            "verified_at": user.email_verified_at,
            "message": "Email verified successfully"
        }

    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str, ip_address: str = None) -> dict:
        """Generate new access token using refresh token."""
        ip_address = ip_address or "unknown"

        # Get refresh token
        db_token = get_refresh_token(db, refresh_token)
        if not db_token or not db_token.is_valid():
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_REFRESH",
                result="failure",
                error_code="INVALID_REFRESH_TOKEN",
                ip_address=ip_address
            )
            raise ValueError("INVALID_REFRESH_TOKEN")

        # Get user
        user = get_user_by_id(db, db_token.user_id)
        if not user or user.is_deleted():
            create_audit_log(
                db,
                event_name="AUTH_AUDIT",
                action="event=AUTH_REFRESH",
                result="failure",
                error_code="USER_NOT_FOUND",
                ip_address=ip_address,
                user_id=db_token.user_id
            )
            raise ValueError("USER_NOT_FOUND")

        # Generate new tokens (token rotation)
        tokens = generate_tokens(user.id, user.email)
        new_refresh_expires = get_refresh_token_expiration()

        # Revoke old token and create new one
        revoke_refresh_token(db, refresh_token)
        create_refresh_token(db, user.id, tokens["refresh_token"], new_refresh_expires)

        create_audit_log(
            db,
            event_name="AUTH_AUDIT",
            action="event=AUTH_REFRESH",
            result="success",
            ip_address=ip_address,
            user_id=user.id,
            entity_type="User",
            entity_ids=f"user_id={user.id}"
        )

        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }

    @staticmethod
    def logout_user(db: Session, refresh_token: str, user_id: int, ip_address: str = None) -> dict:
        """Revoke refresh token and logout user."""
        ip_address = ip_address or "unknown"

        # Revoke token
        revoke_refresh_token(db, refresh_token)

        create_audit_log(
            db,
            event_name="AUTH_AUDIT",
            action="event=AUTH_LOGOUT",
            result="success",
            ip_address=ip_address,
            user_id=user_id,
            entity_type="User",
            entity_ids=f"user_id={user_id}"
        )

        return {"message": "Logged out successfully"}

    @staticmethod
    def get_current_user(db: Session, token: str) -> models.User:
        """Verify access token and get current user."""
        payload = verify_access_token(token)
        if not payload:
            raise ValueError("INVALID_TOKEN")

        user_id = int(payload.get("sub"))
        user = get_user_by_id(db, user_id)
        if not user:
            raise ValueError("USER_NOT_FOUND")

        return user
