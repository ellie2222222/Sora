# Finance Backend API

FastAPI-based backend for the Finance application. Implements authentication, workspace management, accounts, transactions, and audit logging.

## Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database and email settings
   ```

3. **Initialize database**:
   ```bash
   # Create database if needed
   createdb finance
   
   # Run migrations
   psql finance < migrations/001_initial_auth_schema.sql
   ```

4. **Run development server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
   ```

Server will be available at `http://localhost:8001`

## API Documentation

Auto-generated OpenAPI documentation available at `http://localhost:8001/docs`

## Phase 1: Authentication (AUTH-US-01 through AUTH-US-04)

Implemented endpoints:
- `POST /api/v1/auth/register` - User registration with email verification
- `POST /api/v1/auth/login` - User login with JWT tokens
- `POST /api/v1/auth/email-verification` - Email verification
- `POST /api/v1/auth/refresh` - Token refresh with rotation
- `POST /api/v1/auth/logout` - User logout

### Key Features

- **JWT Access Tokens** (15 min expiry) + **Refresh Tokens** (7 day expiry)
- **Email Verification** (24 hour token expiry)
- **Brute Force Protection** (5 failed attempts = 15 min lockout)
- **Audit Logging** (all auth events logged to audit_logs table)
- **Token Rotation** (refresh endpoint issues new refresh token, revokes old one)

### Database Schema

**users**: User accounts with email verification tracking
**email_verification_tokens**: Single-use tokens for email verification
**refresh_tokens**: Refresh tokens for token rotation
**login_attempts**: Failed/successful login tracking for brute force protection
**audit_logs**: Append-only audit trail of all auth events

## Testing

Auth flow:
```bash
# 1. Register
curl -X POST http://localhost:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","full_name":"Test User"}'

# 2. Get verification link from email (or check database)
# Verify email via token

# 3. Login
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 4. Refresh token
curl -X POST http://localhost:8001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"..."}'

# 5. Logout
curl -X POST http://localhost:8001/api/v1/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"..."}'
```

## Error Codes

| Code | HTTP Status | Meaning |
|------|-----------|---------|
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `EMAIL_NOT_VERIFIED` | 403 | Email not verified yet |
| `ACCOUNT_LOCKED` | 423 | Too many failed login attempts |
| `INVALID_TOKEN` | 401 | Token is invalid or expired |
| `TOKEN_EXPIRED` | 410 | Verification/refresh token expired |
| `TOKEN_ALREADY_USED` | 409 | Verification token already used |
| `USER_NOT_FOUND` | 404 | User not found |

## Next Phases

- **Phase 2**: Workspace Management (workspace CRUD, member invitations, role management)
- **Phase 3**: Accounts & Transactions (account CRUD, transaction recording)
- **Phase 4**: Categories (category CRUD with archive)
- **Phase 5**: Bills (bill reminders with archive)
- **Phase 6**: Dashboard & Analytics
- **Phase 7**: Audit Compliance
