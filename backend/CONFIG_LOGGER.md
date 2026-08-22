# Configuration Logger Documentation

## Overview

The configuration logger validates and reports the application's environment configuration at startup. It checks critical environment variables, database connectivity, JWT settings, email configuration, and other important settings.

## Features

### 1. **Required Environment Variable Validation**
- Checks if `DATABASE_URL` is set
- Checks if `JWT_SECRET_KEY` is set
- Reports status with ✅ (SET) or ❌ (MISSING)

### 2. **Database Configuration Validation**
- Parses the DATABASE_URL
- Reports: scheme, hostname, port, database name
- Validates credentials are present
- Overall status indicator

### 3. **Security Configuration Report**
- JWT Algorithm
- Access token expiry duration
- Refresh token expiry duration
- Email verification token expiry
- Account lockout settings (max attempts, lockout duration)

### 4. **Email Configuration Report**
- SMTP server address
- SMTP port
- From email address
- Credentials status (configured or not)
- ⚠️ Warning if not configured (emails won't send)

### 5. **Environment-Specific Settings**
- Current environment (development/production)
- Debug mode status

## Integration

The logger is automatically integrated into the FastAPI startup event in `main.py`:

```python
@app.on_event("startup")
def startup():
    """Initialize database on startup."""
    # Log configuration at startup
    ConfigValidator.log_configuration(settings)
    
    # Initialize database
    init_db()
```

## Running the Logger Manually

To manually run the configuration validator:

```bash
docker exec finance-backend python -c "
from app.config import settings
from app.config_logger import ConfigValidator, configure_logging
import logging

configure_logging()
ConfigValidator.log_configuration(settings)
"
```

## Sample Output

```
============================================================
🔧 CONFIGURATION VALIDATION REPORT
============================================================

📋 REQUIRED ENVIRONMENT VARIABLES:
  DATABASE_URL                   ✅ SET
  JWT_SECRET_KEY                 ✅ SET

🗄️  DATABASE CONFIGURATION:
  Scheme:      postgresql
  Host:        postgres
  Port:        5432
  Database:    finance_db
  Credentials: ✅ Present
  Status:      ✅ VALID

🔐 SECURITY CONFIGURATION:
  Algorithm:                HS256
  Access Token Expiry:      15 minutes
  Refresh Token Expiry:     7 days
  Email Verification Time:  1 hour
  Max Login Attempts:       5
  Lockout Duration:         15 minutes

📧 EMAIL CONFIGURATION:
  SMTP Server:      smtp.gmail.com
  SMTP Port:        587
  From Address:     noreply@finance.app
  Credentials:      ✅ Configured

🌍 ENVIRONMENT-SPECIFIC:
  Environment:      development
  Debug Mode:       False

============================================================
✅ CONFIGURATION VALID - Application ready to start
============================================================
```

## Status Indicators

| Icon | Meaning |
|------|---------|
| ✅ | Valid / Set / Present / Configured |
| ❌ | Invalid / Missing / Error |
| ⚠️ | Warning / Not configured but optional |
| 🔧 | Configuration |
| 📋 | Checklist / Variables |
| 🗄️ | Database |
| 🔐 | Security |
| 📧 | Email |
| 🌍 | Environment |

## Files Modified

- `backend/app/config_logger.py` — New configuration validator module
- `backend/app/main.py` — Integration with FastAPI startup event

## Environment Variables Checked

### Required
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET_KEY` — Secret key for JWT token signing

### Optional (with warnings if missing)
- `SMTP_USER` — Email server username
- `SMTP_PASSWORD` — Email server password

### Read from Config
- `SMTP_SERVER` — Email server hostname (default: localhost)
- `SMTP_PORT` — Email server port (default: 587)
- `SENDER_EMAIL` — From email address (default: noreply@finance.app)
- `ENVIRONMENT` — Application environment (default: development)
- `DEBUG` — Debug mode flag (default: False)

## Log Levels

- `INFO` — Configuration status and valid settings
- `WARNING` — Missing optional environment variables or configuration issues
- `ERROR` — Invalid configuration that prevents startup

## Troubleshooting

### Missing DATABASE_URL
If you see: `DATABASE_URL ❌ MISSING`

Fix: Ensure `DATABASE_URL` is set in:
- `docker-compose.yml` environment section
- `.env` file (for local development)
- Docker container environment variables

### Invalid Database Configuration
If you see database status as ❌ INVALID:

Check the DATABASE_URL format:
```
postgresql://username:password@host:port/database_name
```

### SMTP Not Configured
If you see: `Credentials: ⚠️ Not configured`

This is optional. If you want email sending:
- Set `SMTP_USER` environment variable
- Set `SMTP_PASSWORD` environment variable
- Update `SMTP_SERVER` if using non-Gmail provider

## Future Enhancements

Possible additions to the logger:
1. Database connectivity test (attempt connection at startup)
2. Email server connectivity test
3. JWT secret key strength validation
4. Performance baseline logging (startup duration)
5. Configuration drift detection (for production deployments)
