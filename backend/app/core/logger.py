import logging
import os
from urllib.parse import urlparse
from typing import Dict, Any

logger = logging.getLogger(__name__)


class ConfigValidator:
    """Validates and logs environment configuration at startup."""

    @staticmethod
    def validate_database_url(db_url: str) -> Dict[str, Any]:
        """Parse and validate database URL."""
        try:
            parsed = urlparse(db_url)
            return {
                "valid": True,
                "scheme": parsed.scheme,
                "hostname": parsed.hostname,
                "database": parsed.path.strip("/"),
                "port": parsed.port or 5432,
                "has_credentials": bool(parsed.username),
            }
        except Exception as e:
            return {"valid": False, "error": str(e)}

    @staticmethod
    def check_required_env_vars() -> Dict[str, bool]:
        """Check if critical environment variables are set."""
        required_vars = {
            "DATABASE_URL": "database",
            "JWT_SECRET_KEY": "jwt",
        }

        results = {}
        for var, desc in required_vars.items():
            results[var] = os.getenv(var) is not None

        return results

    @staticmethod
    def log_configuration(settings: Any) -> None:
        """Log full configuration state at startup."""
        logger.info("=" * 60)
        logger.info("🔧 CONFIGURATION VALIDATION REPORT")
        logger.info("=" * 60)

        # Check required environment variables
        required_checks = ConfigValidator.check_required_env_vars()
        logger.info("\n📋 REQUIRED ENVIRONMENT VARIABLES:")
        for var, is_set in required_checks.items():
            status = "✅ SET" if is_set else "❌ MISSING"
            logger.info(f"  {var:<30} {status}")

        all_required_set = all(required_checks.values())
        if not all_required_set:
            logger.warning("⚠️  Some required environment variables are missing!")

        # Validate database URL
        db_validation = ConfigValidator.validate_database_url(settings.DATABASE_URL)
        logger.info("\n🗄️  DATABASE CONFIGURATION:")
        if db_validation.get("valid"):
            logger.info(f"  Scheme:      {db_validation['scheme']}")
            logger.info(f"  Host:        {db_validation['hostname']}")
            logger.info(f"  Port:        {db_validation['port']}")
            logger.info(f"  Database:    {db_validation['database']}")
            logger.info(f"  Credentials: {'✅ Present' if db_validation['has_credentials'] else '⚠️  Not present (using defaults)'}")
            logger.info("  Status:      ✅ VALID")
        else:
            logger.error(f"  ❌ INVALID: {db_validation.get('error')}")

        # JWT Configuration
        logger.info("\n🔐 SECURITY CONFIGURATION:")
        logger.info(f"  Algorithm:                {settings.JWT_ALGORITHM}")
        logger.info(f"  Access Token Expiry:      {settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES} minutes")
        logger.info(f"  Refresh Token Expiry:     {settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS} days")
        logger.info(f"  Email Verification Time:  {settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS} hours")
        logger.info(f"  Max Login Attempts:       {settings.MAX_LOGIN_ATTEMPTS}")
        logger.info(f"  Lockout Duration:         {settings.LOCKOUT_DURATION_MINUTES} minutes")

        # Email Configuration
        logger.info("\n📧 EMAIL CONFIGURATION:")
        smtp_configured = bool(os.getenv("SMTP_USERNAME")) and bool(os.getenv("SMTP_PASSWORD"))
        logger.info(f"  SMTP Server:      {settings.SMTP_HOST}")
        logger.info(f"  SMTP Port:        {settings.SMTP_PORT}")
        logger.info(f"  From Address:     {settings.SMTP_FROM_EMAIL}")
        logger.info(f"  Credentials:      {'✅ Configured' if smtp_configured else '⚠️  Not configured (emails will not send)'}")

        # Environment-specific settings
        logger.info("\n🌍 ENVIRONMENT-SPECIFIC:")
        logger.info(f"  Environment:      {os.getenv('ENVIRONMENT', 'development')}")
        logger.info(f"  Debug Mode:       {os.getenv('DEBUG', 'False')}")

        # Final summary
        logger.info("\n" + "=" * 60)
        if all_required_set and db_validation.get("valid"):
            logger.info("✅ CONFIGURATION VALID - Application ready to start")
        else:
            logger.warning("⚠️  CONFIGURATION ISSUES DETECTED - Review above warnings")
        logger.info("=" * 60 + "\n")


def configure_logging() -> None:
    """Configure logging format for the application."""
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[logging.StreamHandler()],
    )
