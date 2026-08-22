# Finance — Claude Code Instructions

> Auto-loaded by Claude Code each session. Governs all code, spec, and design decisions.

---

## Part 1: Common Instructions

### Spec-Driven Development

Before writing any code, confirm a user story exists in the governing spec. If a task conflicts with the spec, amend the spec first — code does not lead, specs do.

### On-Demand Spec Reading

Governing documents are large. Read only the relevant section when triggered by the change type. See the trigger table in Part 2.

---

## Part 2: Project-Specific Instructions

### Governing Documents

Before any code or design decision, these documents take precedence in order:
1. **[Constitution.md](constitution.md)** — Non-negotiable Principles, Development Workflow, Tech Stack Constraints
2. **[SRS.md](SRS.md)** — what the system does and why (CDM, Business Flows, Features/User Stories)
3. **[SDS.md](SDS.md)** — how the system is designed (TDM, Architecture, API Specs, Database Schema)

| Trigger | Read |
|---------|------|
| Adding/renaming domain entities or workspace types | [SRS.md](SRS.md) §2–§6 |
| Writing or reviewing user stories or acceptance criteria | [SRS.md](SRS.md) §7 (relevant feature section only) |
| Role/permission changes | [SRS.md](SRS.md) §6.4 |
| API design, sequence diagrams, or architecture decisions | [SDS.md](SDS.md) (relevant section) |
| New routes, DTOs, or schema changes | [SDS.md](SDS.md) §3–§5 |
| Tech stack constraints | [constitution.md](constitution.md) (already loaded) |

### Project Structure

```
finance/
├── backend/                   # FastAPI app (port 8001)
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── auth/             # Authentication & authorization
│   │   ├── core/             # Config, settings, constants
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic DTOs
│   │   ├── services/         # Business logic
│   │   ├── repositories/     # Data access layer
│   │   ├── dependencies/     # FastAPI dependencies
│   │   ├── middleware/       # CORS, logging, etc.
│   │   ├── utils/            # Helpers, validators
│   │   └── main.py           # App entry point
│   ├── alembic/              # Database migrations
│   ├── tests/                # Unit & integration tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                  # React + Vite app (port 5173)
│   ├── src/
│   │   ├── app/              # App shell, routing
│   │   ├── components/       # Reusable UI components
│   │   ├── features/         # Feature-based modules
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API client services
│   │   ├── stores/           # Redux state management
│   │   ├── types/            # TypeScript interfaces
│   │   ├── utils/            # Helpers, validators
│   │   ├── locales/          # i18n (VI/EN)
│   │   └── main.tsx
│   ├── tests/                # Vitest unit tests
│   └── Dockerfile
├── postgres/                  # Postgres initialization scripts
├── docker-compose.yml
├── SRS.md                     # Requirements specification
├── SDS.md                     # Design specification
├── constitution.md            # Project constitution
├── aif-sdlc.md                # AIF-SDLC workflow
└── README.md
```

### Dev Commands

```bash
# Start all services (local dev with Docker)
docker compose up --build

# Stop and wipe database
docker compose down -v

# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm run test

# Database migrations
cd backend && alembic upgrade head
cd backend && alembic downgrade -1
```

### Service URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8001
- **API Docs (Swagger)**: http://localhost:8001/docs
- **Database**: postgresql://finance_user:finance_pass@localhost:5432/finance_db

### Key Conventions

- **Test files**: `tests/` mirror the source structure (e.g., `tests/services/test_transaction_service.py`)
- **Migrations**: Alembic versioned SQL; immutable once merged
- **Roles**: See Part 2 below

---

## Part 2: Project-Specific Rules

### Business Terminology

Use these terms consistently across code, API contracts, database, and UI:

| Term | Not | Note |
|---|---|---|
| Workspace | Family, Project | e.g., Personal workspace, Family workspace |
| Member | User, Participant | Within a workspace context |
| Account | Wallet | Formal financial account; "wallet" is not a separate entity |
| Transaction | Entry, Record | Income, Expense, Transfer, Refund, Investment, Loan, Debt |
| Budget | Limit, Allowance | Monthly, weekly, yearly, or custom period |
| Category | Tag (tags are separate) | Expense/Income classification |
| Saving Goal | Target, Objective | Target amount with deadline |
| Bill | Recurring Bill, Invoice | Recurring expense with reminder |

Field naming across SRS, SDS, DTOs, database, and UI:
- `code` — business identifier (not `id`)
- `name` — display name
- `balance` — current account balance
- `startDate` / `endDate` — camelCase in DTOs, `start_date` / `end_date` in DB

### Business Rules

**BR-01: Workspace Membership**
A member can join multiple workspaces. A workspace must have at least one OWNER. An OWNER cannot be removed if they are the only owner of a workspace.

**BR-02: Account Ownership**
An account belongs to exactly one workspace. Transfers between accounts in different workspaces are not permitted.

**BR-03: Transaction Immutability**
Once a transaction is recorded, its account and amount cannot be changed — only cancelled/refunded. Edits create a refund transaction + new transaction.

**BR-04: Budget Period Uniqueness**
A workspace can have at most one active budget per period (monthly, weekly, yearly). Overlapping budgets of the same period are rejected.

**BR-05: Saving Goal Tracking**
Transactions tagged with a saving goal increment the goal's progress. Refunded transactions decrement progress.

**BR-06: Bill Auto-Reminder**
Recurring bills generate reminders; no automatic transaction generation. Members must manually record bill payments.

**BR-07: Currency Consistency**
All transactions in an account must use the account's currency. Multi-currency transfers use the target account's currency.

**BR-08: Workspace Invitation**
Invitations are single-use tokens. Expiration defaults to 7 days. Only OWNER can send invitations. Recipient must accept to join workspace.

### Technical Principles

**I. Monorepo Boundaries**
Backend and frontend are separate modules within a single repository. Backend code must not be in `frontend/` and vice versa. Docker Compose and shared README live at repo root.

**II. Backend Layered Architecture**
Backend is organized package-by-layer: `app/api/`, `app/services/`, `app/repositories/`, `app/models/`, `app/schemas/`. New layers must be justified.

**III. Database-First Migrations**
All schema changes go through Alembic versioned migrations. Never use `sqlalchemy.create_all()` or ORM auto-DDL. After migrations, reset with `docker compose down -v`.

**IV. Strict TypeScript**
Frontend is TypeScript-only. No `.js` or `.jsx` files in `src/`. No `any` types without explicit justification. All props, state, API responses, and form schemas are typed. Zod schemas are the source of truth for runtime validation.

**V. Authentication & Authorization**
- All API routes require JWT authentication unless on the public allowlist (auth, health, docs)
- Authorization is enforced at the service layer (not just controller)
- WorkspaceRole determines feature access within a workspace
- Backend returns `403` for disallowed roles, `401` for unauthenticated
- Frontend middleware enforces session validation on protected routes

**VI. Observability**
- Structured JSON logging (Python Loggers with JSON formatter)
- Log levels: `DEBUG` (dev-only), `INFO` (state transitions), `WARN` (recoverable issues), `ERROR` (failures)
- Audit logging for all financial transactions and role changes
- `/health` endpoint must remain functional and public

---

### Access Control

**AC-01: Role-Based Feature Access**

**System Level (SystemRole):**

| Role | Scope |
| --- | --- |
| `ADMIN` | System administration, user management, audit logs |
| `USER` | Standard user access to create/manage workspaces |

**Workspace Level (WorkspaceRole):**

| Role | Scope |
| --- | --- |
| `OWNER` | Create workspace, invite/remove members, delete workspace, approve budgets, manage categories, view all data, change member roles |
| `MEMBER` | Create/edit transactions, create budgets, create saving goals, view workspace data |

**AC-02: Backend Enforces All Authorization**
Authorization is enforced in the service layer. Frontend controls are for UX only. Every protected endpoint validates role and workspace membership.

**AC-03: Workspace Scope Validation**
Members can only access data within their workspace. Cross-workspace queries are rejected with `403`.

**AC-04: Field-Level Response Filtering**
Sensitive fields (personal contact, account numbers) are role-scoped in responses. VIEWER role receives minimal fields.

**AC-05: Audit Log Access Restricted**
Only OWNER can retrieve audit logs. All other roles receive `403`. Unauthenticated requests receive `401`.

---

### API Design Standards

**API-01: Base Path and Versioning**
All business APIs are versioned under `/api/v1/**`. Paths use kebab-case plural resource names (e.g., `/api/v1/transactions`, `/api/v1/saving-goals`).

**API-02: Standardized Response Envelope**
```json
{
  "success": true,
  "message": "Optional message",
  "data": {},
  "meta": {
    "timestamp": "2026-07-30T10:30:00Z"
  }
}
```

**API-03: HTTP Status Mapping**

| Code | Meaning |
|---|---|
| 200 | Successful read/update/action |
| 201 | Successful creation |
| 400 | Malformed input |
| 401 | Unauthenticated |
| 403 | Forbidden or invalid permissions |
| 404 | Resource not found |
| 409 | Business conflict (e.g., duplicate code, invalid state) |
| 422 | Validation error |
| 500 | Unexpected server error |

**API-04: Error Code Format**
Error codes are `UPPER_SNAKE_CASE` with resource prefix (e.g., `WORKSPACE_NOT_FOUND`, `TRANSACTION_IMMUTABLE`, `BUDGET_CONFLICT`).

**API-05: Pagination**
List endpoints support `page` and `pageSize` query parameters. Default: 25, Max: 1000. Responses include `total` and `hasMore` metadata.

**API-06: Filtering & Sorting**
- Filtering: `?category=Food&minAmount=10&maxAmount=100`
- Sorting: `?sortBy=-date` (descending) or `?sortBy=amount` (ascending)
- Multiple sorts: `?sortBy=-date,amount`

---

### Naming Conventions

**NC-01: Entity and DTO Naming**
- Domain entities: PascalCase singular (e.g., `Transaction`, `SavingGoal`, `WorkspaceRole`)
- Request DTOs: PascalCase with `Request` suffix (e.g., `CreateTransactionRequest`)
- Response DTOs: PascalCase with `Response` suffix (e.g., `TransactionResponse`)
- DTO fields: camelCase (e.g., `transactionId`, `workspaceId`, `startDate`)

**NC-02: Database Naming**
- Table names: snake_case plural (e.g., `transactions`, `saving_goals`)
- Column names: snake_case lowercase (e.g., `transaction_id`, `start_date`)
- Primary keys: `id` (bigint or uuid)
- Foreign keys: `<entity>_id` (e.g., `workspace_id`, `account_id`)

**NC-03: API Path Naming**
- Resources: `/api/v1/transactions`, `/api/v1/workspaces/{id}/members`
- Actions: `POST /api/v1/transactions/{id}/refund`

**NC-04: Frontend Element ID Naming**

| Element | Pattern | Example |
|---|---|---|
| Form field | `[entity]-[field-name]` | `transaction-amount`, `budget-name` |
| Submit button | `btn-submit-[entity]` | `btn-submit-transaction` |
| Open create modal | `btn-add-[entity]` | `btn-add-transaction` |
| Edit row button | `btn-edit-[entity]` | `btn-edit-category` |
| Delete row button | `btn-delete-[entity]` | `btn-delete-budget` |
| Table container | `table-[entity]` | `table-transactions` |
| Search input | `search-[field]` | `search-category` |
| Search button | `btn-search` | `btn-search` |
| Modal wrapper | `modal-[entity]` | `modal-transaction` |

---

### Frontend Conventions

**FE-01: Element IDs Required**
All interactive and testable elements must have stable `id` attributes conforming to `NC-04`. These are primary selectors for tests.

**FE-02: Zod Schema as Source of Truth**
Frontend form validation via Zod must align with backend DTO validation. If one changes, update the other in the same commit.

**FE-03: Role-Aware UI**
Navigation, buttons, and form visibility reflect the user's role. Backend enforces all restrictions independently.

**FE-04: shadcn/ui Primitives First**
Use existing shadcn/ui primitives before creating custom components. Shared components live in `src/components/ui/`. Feature-specific components live colocated in the feature folder.

**FE-05: Icon Consistency**
All icons come from Lucide React. No custom SVG icons unless explicitly approved.

**FE-06: Form Feedback**
Every form displays:
- Inline field-level validation errors on blur or submit
- Form-level error summary at the top when multiple errors exist
- Loading state during API submission
- Success toast or redirect confirmation on completion

**FE-07: Dark Mode & i18n**
Dark mode is the default; light mode is a toggle. All strings are i18n-ready (VI/EN). Use i18n library for localization.

---

### Validation Rules

**VL-01: Dual Validation**
Backend validation is the source of truth. Frontend validation (Zod) provides UX feedback only.

**VL-02: Uniqueness**
Codes that must be unique are validated at three levels: frontend debounce check, service layer check, database unique index.

**VL-03: Referential Integrity**
Forms referencing another entity validate that entity exists and is in the correct state. Return `404` if missing, `409` if in invalid state.

**VL-04: Amount & Currency**
Amounts must be positive, non-zero, and match the account's currency. Decimal precision is 2 places (cents).

---

### Logging & Audit

**LA-01: No Sensitive Data in Logs**
Passwords, tokens, account numbers, and personal contact details never appear in logs. User IDs and emails may be logged at INFO level.

**LA-02: Audit Logging**
Critical financial events are logged at `INFO` level:
- Transaction created/edited/cancelled
- Budget approved/rejected
- Member invited/removed
- Role changed
- Workspace created/deleted

Format: `[timestamp] [event_name] [action] [entity_type] [result] [actor_id] [actor_role] [entity_id] [note] [ip]`

**LA-03: Access Denied Logging**
`403` and `401` responses are logged at `WARN` level with actor ID, role, and entity context.

---

### Definition of Done

A feature is not done until:

1. **SRS/SDS Traceability** — Feature is traceable to an SRS user story and SDS section
2. **API Contract Documented** — Endpoint in SDS API Index with success & error responses
3. **Authorization Verified** — Role validation, CSRF (if stateful), audit logging implemented
4. **Validation Implemented** — Required fields, business rules, uniqueness enforced
5. **Frontend/Backend Sync** — Zod schema matches backend DTO validation
6. **Test Coverage** — Happy path + key error cases + role enforcement
7. **Specs Updated** — SRS §7, SDS §5 and §6 are in sync

---

### Technology Stack

**Backend**
- Python 3.13
- FastAPI
- SQLAlchemy 2.0
- Alembic (migrations)
- Pydantic v2 (DTOs)
- PyJWT (authentication)
- Argon2 (password hashing)
- PostgreSQL 16
- Redis (token blacklist, caching, rate limiting)
- Pytest + Testcontainers (tests)
- Loguru (structured logging)

**Frontend**
- Node.js 24.14.0 LTS
- React 19.x
- Vite
- TypeScript 5
- TailwindCSS v4
- shadcn/ui
- Redux Toolkit (state management)
- React Hook Form + Zod (forms)
- Axios (HTTP client)
- Lucide React (icons)
- i18next (i18n)

**Infrastructure**
- Docker Desktop
- Docker Compose
- Non-root container users

---

### Development Workflow

- Local development: `docker compose up --build`
- All three services must start cleanly (postgres, backend, frontend)
- Database resets: `docker compose down -v`
- Migrations must be tested locally before merging

---

### Security Requirements

- No secrets in source files or committed `.env`
- All config injected via environment variables
- Container images run as non-root users
- JWT tokens are short-lived (15 min), refresh tokens are long-lived (7 days)
- Refresh tokens stored in Redis with expiration
- CORS configured to allow frontend only
- Rate limiting on auth endpoints
- Passwords hashed with Argon2
