# AIF-SDLC Review Checklist

**Personal & Family Finance Management System**

Use this checklist to verify that each feature (user story group) meets the Definition of Done before merging to main.

---

## Pre-Implementation

### □ Spec Review
- [ ] User story exists in SRS §7 with clear acceptance criteria
- [ ] Story is traceable to SRS §2 CDM or §5 Business Flow
- [ ] Story prefix and numbering follow conventions (e.g., AUTH-US-01)
- [ ] SDS §6 Feature Implementation Mapping is updated
- [ ] No conflicts with existing stories or business rules (SRS §3)

### □ Design Review
- [ ] API endpoint(s) defined in SDS §4 with request/response examples
- [ ] Database tables and relationships documented in SDS §5
- [ ] Role-based authorization defined in SDS §2.2 and CLAUDE.md AC-01
- [ ] Error codes defined (UPPER_SNAKE_CASE in API spec)
- [ ] Audit logging events identified (what/who/when/why)

---

## Implementation

### Backend

#### Code Quality
- [ ] Controllers are thin: only HTTP binding, role checks, service delegation
- [ ] Services contain all business logic (BR-01 through BR-10)
- [ ] Repositories are pure data access (no business logic)
- [ ] DTOs map correctly between HTTP and domain
- [ ] All inputs validated at service layer
- [ ] Database constraints match business rules (unique indexes, foreign keys, check constraints)

#### Database
- [ ] SQL migration added under `db/migrations/` and applied locally via `node scripts/migrate.mjs`
- [ ] Migration is forward-only and immutable once applied — the runner checksums each file and refuses to re-run a changed one, so a mistake needs a new migration, not an edit
- [ ] Soft-delete columns added where applicable (`deleted_at`)
- [ ] Indexes created on frequently queried columns (foreign keys, status, date)
- [ ] Schema reviewed against SDS §5

#### Authorization & Audit
- [ ] NestJS guards or service-level role checks on all protected endpoints
- [ ] Wallet scoping validated (no cross-wallet data access without the required role on both sides)
- [ ] Audit log created for all state-changing operations
- [ ] Audit log format follows CLAUDE.md LA-02
- [ ] Error responses include appropriate HTTP status and error code

#### Testing
- [ ] Happy path integration test (uses real DB via Testcontainers)
- [ ] Error cases tested: invalid input, missing entity, wrong role, conflict
- [ ] Authorization tests confirm `403` for disallowed roles, `401` for unauthenticated
- [ ] Tests cover all acceptance criteria from SRS §7

### Frontend

#### Code Quality
- [ ] All components are TypeScript; no `any` types without comment
- [ ] Form validation via Zod matches backend DTO validation
- [ ] Components use shadcn/ui primitives; no custom components unless necessary
- [ ] Icons from Lucide React only
- [ ] State management (Zustand for client state, TanStack Query for server state) properly typed and initialized

#### UI & UX
- [ ] All interactive elements have stable `id` attributes (per CLAUDE.md NC-04)
- [ ] Forms display inline validation errors on blur/submit
- [ ] Form-level error summary at top when multiple errors
- [ ] Loading states during API submission
- [ ] Success toast or redirect confirmation on completion
- [ ] Dark mode and light mode both tested
- [ ] i18n strings defined for VI and EN (even if VI translations TBD)

#### Testing
- [ ] Happy path scenario works end-to-end
- [ ] Form validation rejects invalid inputs with clear error messages
- [ ] Role-based UI hiding: controls not visible to disallowed roles
- [ ] API errors handled and displayed to user
- [ ] No console errors or warnings in browser

#### Integration
- [ ] Frontend calls backend API endpoints correctly (base path `/api/v1/...`)
- [ ] No hardcoded localhost:9090 or other backend URLs
- [ ] JWT tokens stored and sent in Authorization headers
- [ ] API proxy configured (if needed)

---

## Specification Alignment

### SRS Synchronization
- [ ] SRS §7 acceptance criteria match implemented behavior
- [ ] If implementation revealed edge cases, SRS §7 updated in same PR
- [ ] SRS §2 CDM and SDS §2.1 traceability table in sync
- [ ] SRS §2 and SDS §2 "Last synced" timestamps updated if any entity changed

### SDS Synchronization
- [ ] SDS §4 API specification includes actual request/response (not templates)
- [ ] SDS §5 database schema matches the SQL files under `db/migrations/`
- [ ] SDS §6 feature mapping updated with actual controller/service/repository names
- [ ] Error codes in SDS §4 API responses match implementation

### Cross-Document Consistency
- [ ] Domain terminology (CDM entity names) used consistently in code, API, database, UI
- [ ] API paths follow kebab-case plural naming (e.g., `/api/v1/saving-goals`)
- [ ] Database columns follow snake_case naming
- [ ] DTOs/enums use PascalCase (e.g., `BudgetStatus`, `TransactionType`)
- [ ] Role names match enum values (ADMIN, MEMBER)

---

## Definition of Done Verification

### 1. SRS/SDS Traceability
- [ ] Feature is traceable to ≥1 SRS user story
- [ ] User story ID and acceptance criteria are in SRS §7
- [ ] SDS §6 Feature Implementation Mapping entry exists with actual code locations
- [ ] SDS §4 API specification includes this feature's endpoints

### 2. API Contract Documented
- [ ] Endpoint(s) listed in SDS §4 API Index (§4.2–§4.10)
- [ ] Request DTO shown with sample JSON
- [ ] Response DTO shown with sample JSON (both success and errors)
- [ ] HTTP status codes documented (200, 201, 400, 401, 403, 404, 409, 422, 500)
- [ ] Error codes documented (e.g., `WALLET_NOT_FOUND`, `PERMISSION_DENIED`)

### 3. Authorization Verified
- [ ] Role validation implemented (service layer, not just controller)
- [ ] Wallet membership validated (user holds an `ACTIVE` role on the wallet)
- [ ] Test confirms `403` for disallowed roles
- [ ] Test confirms `401` for unauthenticated requests
- [ ] Audit log created for critical operations (state changes, access denials)
- [ ] CSRF protection in place for POST/PUT/DELETE (if using cookies; JWT doesn't require CSRF)

### 4. Validation Implemented
- [ ] Required fields validated (both frontend Zod and backend DTOs)
- [ ] Business rules enforced (e.g., BR-01–BR-10 from SRS §3)
- [ ] Uniqueness constraints enforced (e.g., duplicate category name)
- [ ] Referential integrity validated (e.g., account exists, is active)
- [ ] Amount/date/status validation in place

### 5. Frontend/Backend Sync
- [ ] Frontend Zod schema matches backend DTO field names and types
- [ ] Validation rules align (min/max, enum values, format)
- [ ] If DTO changes, both frontend and backend updated in same commit

### 6. Test Coverage
- [ ] ≥1 happy-path integration test
- [ ] ≥2 error-case tests (invalid input, missing entity, conflict, wrong role, etc.)
- [ ] All acceptance criteria from SRS §7 covered by tests
- [ ] Tests pass locally and in CI

### 7. Specs Updated
- [ ] SRS §7 acceptance criteria finalized (edge cases added if discovered)
- [ ] SDS §5 (database schema) updated with actual table/column names
- [ ] SDS §6 (feature mapping) includes actual controller/service/repo method names
- [ ] SDS §2 and SRS §2 "Last synced" dates updated if any entity changed

---

## Code Review Checklist

When reviewing a PR, verify:

### Architecture
- [ ] No business logic in controllers
- [ ] No database queries in services (all via repositories)
- [ ] No hard-coded values; use config/environment variables
- [ ] No circular imports or tight coupling

### Security
- [ ] No SQL injection risks (using parameterized queries)
- [ ] No sensitive data in logs (passwords, tokens, account numbers)
- [ ] Passwords hashed (Argon2)
- [ ] JWT tokens short-lived (15 min), refresh tokens long-lived (7 days)
- [ ] CORS properly configured (frontend origin whitelisted)

### Performance
- [ ] N+1 queries avoided (eager loading or batching)
- [ ] Indexes on foreign keys and frequently queried columns
- [ ] Pagination enforced on list endpoints (no unbounded queries)
- [ ] No blocking I/O in request path (email async if possible)

### Testing
- [ ] Integration tests use real DB (Testcontainers)
- [ ] No mocks of repository layer
- [ ] Tests are isolated (setup/teardown clean DB state)
- [ ] Test names are descriptive (not `test1`, `test2`)

### Documentation
- [ ] API endpoint documented in SDS §4
- [ ] Error codes documented
- [ ] Business logic justified in comments (WHY, not WHAT)
- [ ] Complex queries documented

### Compliance
- [ ] Code follows CLAUDE.md conventions
- [ ] Naming matches SRS terminology
- [ ] Constitution rules (BR-01–BR-10) enforced
- [ ] Definition of Done verified

---

## Pre-Merge Checklist

Before approving the PR:

- [ ] All tests passing (local + CI)
- [ ] Code review approved
- [ ] SRS/SDS/code are in sync
- [ ] No merge conflicts
- [ ] Commits were drafted by the `commit-messages` skill, not hand-written — see CLAUDE.md's Git section
- [ ] No `Co-Authored-By: Claude ...`, "Generated with Claude Code", or model name anywhere in the commit messages, PR body, code comments, or docs
- [ ] Migration tested against a disposable database (`node scripts/migrate.mjs --status` before/after) — never `docker compose down -v` or any other command that wipes real data; see CLAUDE.md's Data Safety section
- [ ] If this PR included a verification/double-check/audit pass, it produced a `verifications/YYYY-MM-DD-slug.md` report — see CLAUDE.md's Verification Reports section
- [ ] All Definition of Done items verified

---

## Post-Merge Deployment

- [ ] Run migrations on staging: `node scripts/migrate.mjs`
- [ ] Smoke test: happy path works end-to-end
- [ ] Verify audit logs are being generated
- [ ] Monitor error rates on dashboard
- [ ] Update RUNBOOK.md if new steps/commands needed

---

## Common Failures & Remediation

| Failure | Cause | Fix |
|---------|-------|-----|
| Tests pass locally but fail in CI | DB schema drift; migrations not applied | Run migrations; reset local DB |
| API returns 403 but user should have access | Wallet membership check missing | Add wallet membership/role validation in service |
| API returns 403 for a wallet the user has no access to at all | Should be 404 — a 403 confirms the id is real (see CLAUDE.md AC-01) | Return 404 when there's no membership row; reserve 403 for "member, but role too low" |
| Field appears in API response but SDS omits it | Docs out of sync with code | Update SDS §4 response schema |
| Duplicate error code across endpoints | No coordination; ad-hoc error codes | Define error codes centrally in SDS §4 |
| Frontend form validation passes but backend rejects | Zod schema mismatched with DTO | Sync both in same commit |
| N+1 query in transaction list | Eager loading not configured | Add `joinedload` or batch query |
| Audit log missing for critical operation | Service doesn't call audit log function | Add audit log call to service method |

---

## Notes

- This checklist is a guide, not a prison. Exceptions are OK with documented reason in PR description.
- Use it to build muscle memory for what "done" means.
- Update it as you discover gaps (e.g., "we forgot to test X").
- Template repo uses this in all PRs; no exceptions without explicit team approval.

