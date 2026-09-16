# Critical Bug Prevention & Historical Gotchas

Each rule below was established to permanently prevent a regression of a specific, high-impact bug encountered in this codebase.

---

### 1. Money is Never a JS Number
- Floats cannot accurately represent currency arithmetic (`0.1 + 0.2 === 0.30000000000000004`).
- Decimal amounts are transported as strings, stored as `DECIMAL(19,4)`, and operated on using scaled `bigint` in [`packages/contracts/src/money.ts`](file:///d:/Code/sora/packages/contracts/src/money.ts).
- `node-postgres` NUMERIC (OID 1700) and INT8 (OID 20) text overrides in [`server/src/database/pg-types.ts`](file:///d:/Code/sora/server/src/database/pg-types.ts) prevent driver-level float conversions. Never remove them or call `Number(amount)`.
- `parseMoney` rejects values with more than 4 decimal places instead of rounding.

### 2. Returning `403` to Non-Members Leaks Resource Existence
- Returning `403 Forbidden` to a caller without a membership row confirms that the requested wallet or account ID exists.
- Non-members **must** receive `404 Not Found`.
- Reserve `403` exclusively for callers who are established members but lack the required role.

### 3. Wallet Ownership Transfer: Demote Before Promote Under Lock
- `uq_wallet_single_owner` is a strict partial unique index on active owners. Attempting to promote a new owner before demoting the current one fails immediately with a constraint violation.
- Ownership transfer must:
  1. Execute inside a single database transaction.
  2. Acquire `SELECT ... FOR UPDATE` on all membership rows for the wallet.
  3. Demote the current owner to editor.
  4. Promote the designated member to owner.

### 4. Business Rules Belong in Database Constraints
- The API is not the sole database writer (migrations, admin scripts, and test probes write directly).
- Critical invariants (ranges, statuses, non-negative bounds) must be enforced with `CHECK` constraints, partial unique indexes, and GIST exclusions.

### 5. Budget Overlap Cannot Be Expressed with Unique Indexes
- Two date ranges can overlap without sharing a common start or end date.
- Enforce non-overlapping active budgets using the Postgres GIST exclusion constraint `excl_budget_overlap` on `daterange(start_date, end_date, '[]')`.

### 6. Invitations Are Not Pending Member Rows
- `wallet_members.status` is strictly `ACTIVE` or `REVOKED`.
- Do not create a `PENDING` member row: doing so would require a nullable `user_id`, weakening the foreign key on which all access control joins depend.
- Invitations are stored separately in `wallet_invitations`, keyed by email and hashed token.

### 7. Zero Duplication of `@sora/contracts`
- Do not replicate schemas, enums, error codes, routes, or calculation math in server or mobile code.
- Always import from `@sora/contracts`. Run `node scripts/check-contract-parity.mjs` to mechanically verify alignment across SQL, code, and documentation.

### 8. GitHub Actions `hashFiles()` at Job Level Evaluates Empty
- Job-level `if:` conditions run before the workspace repository is checked out. `hashFiles()` evaluates to an empty hash at the job level, causing guarded jobs to silently skip.
- Guard steps at the step level after checkout, or use `needs:` dependencies.

### 9. Verify Stack Claims and Eliminate Dangling References
- Do not reference non-existent specifications (e.g., there is no `constitution.md`).
- Never assume tools or libraries from generic patterns (e.g. no Zustand, no Prisma). Check the actual `package.json` and codebase.

### 10. Local Postgres 17 + npm Is the Documented Standard
- The canonical workflow assumes a host installation of PostgreSQL 17 and npm.
- Never write instructions that require a container runtime (Docker) as their only path. Docker compose is an optional secondary convenience, not the baseline.

### 11. Comments Explain "Why", Never "What"
- Code should be self-documenting through clean naming.
- Only comment when documenting business rationale, workarounds, performance trade-offs, or external constraints.
- Never maintain debug journals, investigation histories, or commented-out code.
- Every `TODO` or `FIXME` must reference an issue or verification report.

### 12. Strict Ban on AI-Authorship Trailers
- No `Co-Authored-By: ...`, `Generated with...`, or AI model names in commits, PR descriptions, code comments, or documentation.

### 13. Active Locales: English (`en`) and Vietnamese (`vi`) Only
- All other locales (`de`, `es`, `fr`, `hi`, `ja`, `ko`, `ru`, `zh`) are inactive.
- When adding or editing i18n keys, modify **only** `en.ts` and `vi.ts` with 100% key parity. Do not generate keys for inactive locales.

### 14. Barrel Export Require Cycles
- Avoid circular dependencies in `mobile/src/**`:
  - Outside imports must go through the destination's `@/...` barrel.
  - Sibling imports within the same folder must use direct relative paths (`./...`).
  - Broad orchestrators (such as `ModalProvider.tsx` or sync API slices) must import dependencies via direct paths and must **not** be exported in their folder's barrel.

### 15. NativeWind v4: `Pressable` Style Must Never Be a Function
- In NativeWind v4 / `react-native-css-interop`, `cssInterop(Pressable, { className: "style" })` globally wraps `Pressable`.
- Passing a function to `style` (e.g. `style={({ pressed }) => ({ ... })}`) causes the function to be evaluated via an object spread, which silently evaluates to `{}`. Background, border, padding, and layout styles disappear at runtime.
- **Solution**: Track interaction state locally using `useState` and `onPressIn`/`onPressOut`, and pass `style` as a plain object or array:
  ```tsx
  // ❌ BROKEN in NativeWind v4:
  <Pressable style={({ pressed }) => ({ backgroundColor: pressed ? '#ccc' : '#fff' })}>

  // ✅ CORRECT:
  const [pressed, setPressed] = useState(false);
  <Pressable
    onPressIn={() => setPressed(true)}
    onPressOut={() => setPressed(false)}
    style={{ backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface }}
  >
  ```
