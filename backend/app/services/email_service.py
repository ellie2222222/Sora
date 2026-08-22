import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    @staticmethod
    def _get_jinja_env():
        """Get or create Jinja2 environment."""
        template_dir = Path(__file__).parent.parent / "templates"
        logger.debug(f"[EMAIL] Template directory: {template_dir}")
        logger.debug(f"[EMAIL] Template directory exists: {template_dir.exists()}")

        if template_dir.exists():
            logger.debug(f"[EMAIL] Templates found: {list(template_dir.glob('*.html'))}")

        return Environment(loader=FileSystemLoader(str(template_dir)))

    @staticmethod
    def send_verification_email(email: str, token: str, full_name: str = None) -> bool:
        """Send email verification link to user."""
        try:
            logger.info(f"[EMAIL] Starting email send process for {email}")

            if not settings.SMTP_HOST or not settings.SMTP_PORT:
                logger.warning("[EMAIL] SMTP not configured, skipping email send")
                return False

            # Build verification URL (frontend will use this)
            verification_url = f"{settings.FRONTEND_URL}/email-verification?token={token}"
            logger.debug(f"[EMAIL] Verification URL: {verification_url}")

            # Prepare email content
            subject = "Verify your email address"
            recipient_name = full_name or email.split("@")[0]

            # Prepare template variables
            template_vars = {
                "recipientName": recipient_name,
                "verificationUrl": verification_url,
                "token": token,
                "expiryHours": settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS,
                "frontendUrl": settings.FRONTEND_URL,
                "currentYear": datetime.now().year
            }

            # Render HTML template
            try:
                jinja_env = EmailService._get_jinja_env()
                template = jinja_env.get_template("verification_email.html")
                html_body = template.render(**template_vars)
                logger.debug(f"[EMAIL] Rendered HTML template for {email}")
            except Exception as template_error:
                logger.warning(f"[EMAIL] Failed to render template: {template_error}. Using fallback HTML.")
                # Fallback HTML if template fails
                html_body = EmailService._get_fallback_html(template_vars)

            # Prepare plain text fallback
            text_body = f"""
Email Verification

Hi {recipient_name},

Thank you for signing up! To complete your registration and secure your account, please verify your email address.

Verification Link:
{verification_url}

Verification Code:
{token}

Expiry: This link expires in {settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS} hour(s).

If you didn't create this account, you can safely ignore this email.

Need help? Contact us at support@finance.app

© {datetime.now().year} Finance App. All rights reserved.
            """

            logger.debug(f"[EMAIL] Prepared email content for {email}")

            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = email

            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            logger.info(f"[EMAIL] Connecting to SMTP server {settings.SMTP_HOST}:{settings.SMTP_PORT}")

            # Send email
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                logger.debug(f"[EMAIL] Connected to SMTP server")

                if settings.SMTP_USE_TLS:
                    logger.debug(f"[EMAIL] Starting TLS encryption")
                    server.starttls()

                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    logger.debug(f"[EMAIL] Authenticating with SMTP server")
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

                logger.info(f"[EMAIL] Sending verification email to {email}")
                server.send_message(msg)
                logger.info(f"[EMAIL] Verification email sent successfully to {email}")

            return True

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"[EMAIL] SMTP authentication failed: {str(e)}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"[EMAIL] SMTP error sending to {email}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"[EMAIL] Unexpected error sending to {email}: {type(e).__name__}: {str(e)}")
            return False

    @staticmethod
    def _get_fallback_html(template_vars: dict) -> str:
        """Fallback HTML if template rendering fails."""
        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - Finance App</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 24px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Verify Your Email</h1>
            <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Complete your Finance App registration</p>
        </div>
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; font-size: 16px; color: #1f2937;">
                Hi <strong style="color: #3b82f6;">{template_vars.get('recipientName', 'User')}</strong>,
            </p>
            <p style="margin: 0 0 24px 0; font-size: 15px; color: #4b5563; line-height: 1.7;">
                Thank you for signing up! To complete your registration and secure your account, please verify your email address by clicking the button below.
            </p>
            <div style="text-align: center; margin: 40px 0;">
                <a href="{template_vars.get('verificationUrl', '#')}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Verify Email Address
                </a>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: center; border-left: 4px solid #3b82f6;">
                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600;">
                    Or use this verification code:
                </div>
                <div style="font-family: 'Courier New', monospace; font-size: 13px; word-break: break-all; color: #3b82f6; font-weight: 500; padding: 12px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
                    {template_vars.get('token', '')}
                </div>
            </div>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px; font-size: 13px; color: #92400e;">
                <strong style="color: #dc2626;">This link expires in {template_vars.get('expiryHours', 1)} hour(s).</strong> Please verify your email soon.
            </div>
        </div>
        <div style="background: #f9fafb; padding: 20px 32px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
            <div>© {template_vars.get('currentYear', 2024)} Finance App. All rights reserved.</div>
        </div>
    </div>
</body>
</html>
        """
