# Technical Standards & Architecture

## The Shared Contract (`@sora/contracts`)

[`@sora/contracts`](file:///d:/Code/sora/packages/contracts/) is the single source of truth for all shared models, enums, validation schemas, response types, error codes, route definitions, and money math.
- Both `server/` and `mobile/` consume `@sora/contracts`. Neither redefines these entities.
- Run `node scripts/check-contract-parity.mjs` mechanically to verify that schemas, contracts, and API specs agree.
- `@sora/contracts` must be built (`npm run build -w @sora/contracts`) before typechecking dependent packages.

---

## Money & Arithmetic Standard

1. **Money is Never a JavaScript Number**:
   - Floating-point arithmetic (`0.1 + 0.2 === 0.30000000000000004`) causes untraceable ledger discrepancies.
   - All amounts cross the wire as strings.
   - In Postgres, currency amounts are stored as `DECIMAL(19,4)`.
   - All client and server math is computed using scaled `bigint` helpers in [`packages/contracts/src/money.ts`](file:///d:/Code/sora/packages/contracts/src/money.ts).
2. **Database Driver Parsers**:
   - `node-postgres` parses `NUMERIC` (OID 1700) and `INT8` (OID 20) into JavaScript numbers by default.
   - [`server/src/database/pg-types.ts`](file:///d:/Code/sora/server/src/database/pg-types.ts) overrides these parsers to return raw text strings. **Never remove these overrides**.
3. **Decimal Precision**:
   - Amounts support up to 4 decimal places.
   - `parseMoney` strictly rejects inputs with >4 decimals rather than silently rounding or truncating.
4. **Formatting**:
   - Render money through the `<Money>` component, or `formatMoneyString`/`formatScaled` (`mobile/src/utils/money.ts`) where a plain string is needed. Never call `Number(amount)` or `toLocaleString` on raw strings. `formatMoney`/`formatMoneyCompact` in `@sora/contracts` produce a wire `MoneyString`, not display text.

---

## API Design & Standards

- **Routing**: Prefixed with `/api/v1/**` via `ROUTES` in `@sora/contracts`. Paths use kebab-case plural resource names (`/wallets/{id}/members`).
- **Response Envelope**: Every response is wrapped in `ApiEnvelope<T>`:
  ```typescript
  {
    success: boolean;
    message?: string;
    data: T;
    meta?: { pagination?: PaginationMeta };
  }
  ```
- **Error Codes**: `UPPER_SNAKE_CASE` resource-prefixed codes defined in `ERROR_CODES` with matching status in `ERROR_STATUS`. Never invent an ad-hoc error code at a call site.
- **Pagination**: Standard query params `?page=1&pageSize=25` (max 200). All collection endpoints must paginate.
- **Sorting**: Format `?sortBy=-transactionDate,amount` (leading hyphen indicates descending order).

---

## Mobile Architecture (`@sora/mobile`)

- **State Management**:
  - Server state: Redux Toolkit + RTK Query (`mobile/src/app/store/api/*`) driven through `axiosBaseQuery`.
  - Local state: Plain Redux slices (`authSlice`, `offlineQueueSlice`).
  - Do **NOT** introduce Zustand or mirror server data into plain Redux slices (which would create multiple out-of-sync caches).
- **Form Handling**: React Hook Form combined with Zod schemas imported from `@sora/contracts`.
- **Security**: Sensitive tokens (access & refresh tokens) must be stored in `expo-secure-store`, never `AsyncStorage`.
- **UI & Theming**:
  - Dark mode by default; light mode togglable.
  - Colors and spacing reference theme tokens from `design-system/`, not hardcoded literals.
  - Icons sourced strictly from `lucide-react-native`.
- **Active Locales**:
  - Active locales are strictly English (`en`) and Vietnamese (`vi`) (`['en', 'vi'] as const`).
  - Never translate new keys into disabled locales (`de`, `es`, `fr`, `hi`, `ja`, `ko`, `ru`, `zh`). Full key parity is maintained between `en.ts` and `vi.ts`.
- **Test Selectors**:
  - Use `testID` attributes, the only stable selector the Maestro E2E suite (`id:`) can address. The full pattern table is `CLAUDE.md` → NC-04:
    - Root screens: `screen-[name]`
    - Input fields: `input-[entity]-[field]`
    - Submit buttons: `btn-submit-[entity]`
    - Row elements: `row-[entity]-[id]`
    - Sheet/Modal containers: `sheet-[entity]`

---

## Module Import Boundaries & Barrels

- **External Imports**: When importing from outside a directory, use the package/directory barrel alias (`@/components`, `@/features/<name>`, `@/services/<name>`).
- **Sibling Imports**: When importing siblings within the same directory, use direct relative paths (`./sibling`), never the directory's own barrel.
- **Orchestrators**: Orchestrating modules that import across many features (e.g. `ModalProvider.tsx` or sync API slices) must use direct deep paths and should not be re-exported from barrels, preventing circular require cycles.

---

## Database & Migrations

- **Engine**: PostgreSQL 17 managed via raw SQL forward-only migrations in `db/migrations/`.
- **Query Layer**: Kysely typed SQL + `pg`. No full-blown ORMs.
- **Constraints**: Critical business rules must be backed by database constraints (`CHECK`, partial unique indexes, GIST exclusion).
- **Immutability**: Applied migrations are immutable. Never edit historical migrations; create a new migration for schema changes.
- **Data Safety**:
  - Never drop databases, truncate tables, or run unconstrained `DELETE`/`UPDATE` operations.
  - Financial records are never hard-deleted: wallets, accounts, categories and budgets are archived, transactions are marked `DELETED` (the row stays), members are `REVOKED`.

---

## Definition of Done (7 Quality Gates)

1. **Traceable**: Mapped to an `SRS.md` story and `docs/API_SPECIFICATION.md` endpoint.
2. **Contract-First**: Types, schemas, and routes originate in `@sora/contracts`; `check-contract-parity.mjs` passes.
3. **Authorized**: Role checks enforced server-side; AC-01 verified (404 for non-members); mutation audit logged.
4. **Validated**: Zod schema at edge; service lookup validations; DB constraints verified.
5. **Derived, Not Stored**: No cached computation columns (BR-05).
6. **Tested**: Happy path, documented error codes, and permission boundary tested.
7. **Specs Updated**: Specifications, design documents, and task plans updated in the same change.
