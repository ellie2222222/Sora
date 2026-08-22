# Finance Application

A full-stack personal finance management application built with FastAPI (backend), Next.js (frontend), and PostgreSQL (database).

## Architecture

- **Backend**: FastAPI (Python 3.11)
- **Frontend**: Next.js 16 with TypeScript and React 19
- **Database**: PostgreSQL 16
- **Authentication**: JWT with token rotation
- **API**: RESTful with standardized response envelopes

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Setup

1. Clone the repository:
```bash
git clone <repo-url>
cd finance
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - Update `JWT_SECRET_KEY` with a strong secret
   - Configure SMTP settings for email (optional for development)
   - Adjust database credentials if needed

4. Start all services:
```bash
docker compose up --build
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- API Docs: http://localhost:8001/docs

### Development

#### Local Development (without Docker)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

#### Using Docker for Development

```bash
docker compose up --build
```

The backend will watch for file changes with `--reload` flag.

### Database

The database is automatically initialized when the backend service starts. To reset the database:

```bash
docker compose down -v
docker compose up --build
```

The `-v` flag removes the database volume, starting fresh.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` — User registration
- `POST /api/v1/auth/login` — User login
- `POST /api/v1/auth/email-verification` — Email verification
- `POST /api/v1/auth/refresh` — Refresh access token
- `POST /api/v1/auth/logout` — Logout

### Workspaces
- `POST /api/v1/workspaces` — Create workspace
- `GET /api/v1/workspaces` — List user's workspaces
- `GET /api/v1/workspaces/{id}` — Get workspace details
- `PUT /api/v1/workspaces/{id}` — Update workspace
- `DELETE /api/v1/workspaces/{id}` — Delete workspace (soft delete)

### Workspace Members
- `POST /api/v1/workspaces/{id}/members/invite` — Invite member
- `PUT /api/v1/workspaces/{id}/members/{memberId}/role` — Update member role
- `DELETE /api/v1/workspaces/{id}/members/{memberId}` — Remove member

### Invitations
- `POST /api/v1/invitations/accept` — Accept invitation

See [API Documentation](http://localhost:8001/docs) for complete endpoint details.

## Project Structure

```
finance/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app setup
│   │   ├── config.py         # Configuration
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── crud.py           # Database operations
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── auth_service.py   # Auth business logic
│   │   ├── workspace_service.py # Workspace business logic
│   │   └── jwt_utils.py      # JWT utilities
│   ├── migrations/           # SQL migrations
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js routes
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities & API clients
│   │   ├── schemas/          # Zod validation schemas
│   │   └── styles/           # CSS
│   ├── Dockerfile
│   ├── next.config.js
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## Features

### Phase 1: Authentication ✅
- User registration with email verification
- Secure login with brute-force protection (5 attempts → 15-min lockout)
- JWT token management (15-min access, 7-day refresh)
- Account logout with token revocation
- Audit logging for all auth events

### Phase 2: Workspace Management ✅
- Create and manage personal workspaces
- Multi-workspace support
- Member invitations with email
- Role-based access control (OWNER, ADMIN, MEMBER)
- Auto-created default categories (15 predefined)
- Soft-delete for workspaces

### Upcoming Phases
- Phase 3: Accounts & Transactions
- Phase 4: Categories (CRUD + archive)
- Phase 5: Bills (reminders + archive)
- Phase 6: Dashboard & Analytics
- Phase 7: Audit Compliance

## Authentication

The application uses JWT (JSON Web Tokens) for authentication:

- **Access Token**: 15-minute expiry, sent in Authorization header
- **Refresh Token**: 7-day expiry, stored in cookies (HttpOnly)
- **Token Rotation**: New refresh token issued on each refresh
- **Automatic Refresh**: Frontend automatically refreshes expired tokens

## Security

- Passwords hashed with bcrypt
- CSRF protection via SameSite cookies
- Brute-force attack prevention
- Role-based access control (RBAC)
- Soft deletes (no permanent data loss)
- Audit logging for compliance
- Non-root container users in Docker

## Development Notes

### Code Organization

**Backend:**
- Service layer handles business logic
- CRUD layer for database operations
- Controllers are thin, handling HTTP binding only
- SQLAlchemy models define database schema

**Frontend:**
- Next.js 16 with React 19
- TypeScript strict mode
- Zod for runtime validation
- React Hook Form for forms
- Tailwind CSS v4 for styling
- Separate API service files (auth, workspace, etc.)

### Adding New Features

1. **Backend**: Add database migration → Update models → Implement CRUD → Create service logic → Add routes
2. **Frontend**: Create Zod schema → Add API methods → Build pages/components → Test with E2E

## Troubleshooting

**Port already in use:**
```bash
# Change port in docker-compose.yml or stop conflicting services
lsof -i :3000  # Find process on port 3000
kill -9 <PID>  # Kill process
```

**Database connection errors:**
```bash
# Ensure postgres is healthy
docker compose ps
docker compose logs postgres
```

**Frontend can't reach backend:**
- Verify `NEXT_PUBLIC_API_URL` matches backend service name
- Check Docker network connectivity
- Ensure backend service is running

## License

MIT
