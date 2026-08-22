from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
import secrets
from jose import JWTError, jwt
from .config import settings


def generate_tokens(user_id: int, email: str) -> Dict[str, str]:
    """Generate both access and refresh tokens."""
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token_string()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token
    }


def create_access_token(user_id: int, email: str) -> str:
    """Create a JWT access token."""
    now = datetime.now(timezone.utc)
    expires_delta = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = now + expires_delta

    to_encode = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token_string() -> str:
    """Generate a secure random refresh token."""
    return secrets.token_urlsafe(32)


def create_email_verification_token() -> str:
    """Generate a secure email verification token."""
    return secrets.token_urlsafe(32)


def verify_access_token(token: str) -> Optional[Dict]:
    """Verify and decode JWT access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def get_expiration_time(minutes: int = None) -> datetime:
    """Get expiration time based on configured duration."""
    if minutes is None:
        minutes = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def get_refresh_token_expiration() -> datetime:
    """Get refresh token expiration time."""
    return datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)


def get_email_verification_token_expiration() -> datetime:
    """Get email verification token expiration time."""
    return datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS)
