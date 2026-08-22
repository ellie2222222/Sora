from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )

    # Database
    DATABASE_URL: str = "postgresql://finance:finance123@localhost:5432/finance_db"

    # JWT
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Email
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 1
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_FROM_EMAIL: str = "noreply@finance.app"
    FRONTEND_URL: str = "http://localhost:3000"

    # Security
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15

    # Exchange rates (BR-07a) — the system fetches the snapshot rate; a user
    # never enters one. The default provider is free and needs no API key.
    EXCHANGE_RATE_API_URL: str = "https://open.er-api.com/v6/latest"
    EXCHANGE_RATE_TIMEOUT_SECONDS: float = 5.0
    # Providers publish about once a day; refresh twice a day.
    EXCHANGE_RATE_CACHE_TTL_MINUTES: int = 720
    # Last-resort USD expressed in VND, used only when the provider is
    # unreachable and no cached rate is recent enough. 0 disables it, so the
    # write fails instead of booking money at a made-up rate.
    EXCHANGE_RATE_FALLBACK_USD_VND: float = 0


settings = Settings()
