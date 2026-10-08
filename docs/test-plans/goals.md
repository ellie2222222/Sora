# Test plan: Saving goals & contributions

**Stories:** SRS §9 SAV-US-01 Create · 02 Contribute · 03 Watch progress · 04 Adjust · 05 Remove a contribution · 06 Complete or cancel
**Contract:** API spec §13 Goals & contributions
**Rules:** BR-05 (progress derived from contributions, never stored), BR-07 (contribution currency = goal = account), VL-03 (archived account → 409), LA-02, rule 16 (audit inside a transaction uses a savepoint)
**Code under test:** `server/src/goals/` (`goals.service.ts`, `goal-contributions.service.ts`, `goal-access.ts`), `packages/contracts/src/calc.ts` (`calculateGoalCurrent/Remaining/Progress`, `isGoalReached`), `mobile/src/features/goals/`, `mobile/src/services/guest/guestGoals.ts`

A removed contribution's backing transaction is marked `DELETED`, never removed. SRS SAV-US-05 and the API spec §13.8 both say so.

## Objectives

1. A transaction-backed contribution and its EXPENSE are written together or not at all, and removing one restores the account.
2. An earmark advances the goal without moving money.
3. Progress caps at 100%, remaining floors at 0, and a closed goal accepts nothing more.

## Test data & environment

- `integration.planning.test.ts`: one user; goals created per test with `probe-<uuid>` names; accounts via `createAccount`.
- Guest copy: `guestGoalsApi` on in-memory storage ([guestDerived.test.ts:321](../../mobile/src/services/guest/guestDerived.test.ts#L321)).

## Test cases

| ID | Story | Scenario | Type | Expected result | Automated by | Status |
|---|---|---|---|---|---|---|
| TC-SAV-01 | SAV-US-01 | Zero target; no target date | DB probe + Integration | Zero rejected by `chk_goal_target`; an undated goal accepted with 0 progress | [001_constraints:327](../../db/tests/001_constraints.sql#L327), [integration.goals:43](../../server/test/integration.goals.test.ts#L43) | Covered |
| TC-SAV-02 | SAV-US-01 | Create is audited; VIEWER create | Integration | `GOAL_CREATED`; VIEWER 403 | [integration.goals:57](../../server/test/integration.goals.test.ts#L57) | Covered |
| TC-SAV-03 | SAV-US-02 | Contribution without `recordAsTransaction` | Unit + Mobile unit + Integration | Defaults to an earmark; account balance unchanged; goal advances | [schemas:352](../../packages/contracts/test/schemas.test.ts#L352), [integration.goals:72](../../server/test/integration.goals.test.ts#L72), [guestDerived:372](../../mobile/src/services/guest/guestDerived.test.ts#L372) | Covered |
| TC-SAV-04 | SAV-US-02 | Contribution with `recordAsTransaction` and a category | Integration + Mobile unit | 201 with `transactionId`; backing row EXPENSE/COMPLETED/`250.0000`; balance `4750.0000`; progress 25, count 1; the budget counts it | [integration.planning:91](../../server/test/integration.planning.test.ts#L91), [guestDerived:387](../../mobile/src/services/guest/guestDerived.test.ts#L387) | Covered |
| TC-SAV-05 | SAV-US-02 | A transaction-backed contribution fails partway (e.g. its insert is refused after the expense is written) | Integration | Neither row remains | [integration.goals:87](../../server/test/integration.goals.test.ts#L87) (`AuditService.record` stubbed to throw after both inserts) | Covered |
| TC-SAV-06 | SAV-US-02 | `recordAsTransaction` with no category | Integration + Mobile unit | 422 with `fields.categoryId` | [integration.planning:158](../../server/test/integration.planning.test.ts#L158), [guestDerived:407](../../mobile/src/services/guest/guestDerived.test.ts#L407) | Covered |
| TC-SAV-07 | SAV-US-02 | Contribution from an archived account | Integration | 409 `ACCOUNT_ARCHIVED` | [integration.planning:118](../../server/test/integration.planning.test.ts#L118) | Covered |
| TC-SAV-08 | SAV-US-02 | Currency differs from the goal's; account from another wallet | Integration + Mobile unit | 422 `ACCOUNT_CURRENCY_MISMATCH`; other wallet refused | [integration.goals:112](../../server/test/integration.goals.test.ts#L112), guest copy: [guestDerived:422](../../mobile/src/services/guest/guestDerived.test.ts#L422) | Covered (own other wallet 403 `FORBIDDEN`; a stranger's account 404 `ACCOUNT_NOT_FOUND`, AC-01) |
| TC-SAV-09 | SAV-US-02 | Link one transaction to two contributions | DB probe | Second link rejected | [001_constraints:345](../../db/tests/001_constraints.sql#L345), [:351](../../db/tests/001_constraints.sql#L351) | Covered |
| TC-SAV-10 | SAV-US-02 | VIEWER contributes | Integration | 403 `FORBIDDEN` | [integration.access:96](../../server/test/integration.access.test.ts#L96) | Covered |
| TC-SAV-11 | SAV-US-03 | Progress at, below and above the target | Unit + Integration + Mobile unit | Derived from contributions; remaining floors at 0; progress caps at 100; 0% with none | [calc:276](../../packages/contracts/test/calc.test.ts#L276), [calc:284](../../packages/contracts/test/calc.test.ts#L284), [calc:291](../../packages/contracts/test/calc.test.ts#L291), [integration.planning:91](../../server/test/integration.planning.test.ts#L91), [guestDerived:329](../../mobile/src/services/guest/guestDerived.test.ts#L329), [guestDerived:357](../../mobile/src/services/guest/guestDerived.test.ts#L357), [pendingTotals:262](../../mobile/src/services/sync/pendingTotals.test.ts#L262) | Covered |
| TC-SAV-12 | SAV-US-03 | List contributions (paged, each marked earmark or moved); list goals filtered by status | Integration | Paged list with the flag; filter honoured | [integration.goals:139](../../server/test/integration.goals.test.ts#L139) | Covered |
| TC-SAV-13 | SAV-US-03 | Non-member reads a goal | Integration | 404 `GOAL_NOT_FOUND` | [integration.access:59](../../server/test/integration.access.test.ts#L59) | Covered |
| TC-SAV-14 | SAV-US-04 | `PATCH` target amount; try to change currency | Integration | Remaining and progress change on the next read, contributions don't; currency unchanged | [integration.goals:189](../../server/test/integration.goals.test.ts#L189) | Covered |
| TC-SAV-15 | SAV-US-05 | Remove a transaction-backed contribution | Integration + Mobile unit | 204; backing transaction `DELETED` (row kept); balance back to `5000.0000` | [integration.planning:91](../../server/test/integration.planning.test.ts#L91), [guestDerived:468](../../mobile/src/services/guest/guestDerived.test.ts#L468) | Covered |
| TC-SAV-16 | SAV-US-05 | Remove an unknown contribution; removal is audited | Integration | 404 `CONTRIBUTION_NOT_FOUND`; `GOAL_CONTRIBUTION_REMOVED` row | [integration.goals:210](../../server/test/integration.goals.test.ts#L210) | Covered |
| TC-SAV-17 | SAV-US-06 | Complete or cancel a goal, then contribute | Integration + Mobile unit | Contributions kept; new contribution 409 `GOAL_NOT_ACTIVE`; closing audited | [integration.planning:132](../../server/test/integration.planning.test.ts#L132); guest copy: [guestDerived:437](../../mobile/src/services/guest/guestDerived.test.ts#L437), [guestDerived:454](../../mobile/src/services/guest/guestDerived.test.ts#L454) | Covered |
| TC-SAV-18 | SAV-US-02 | Contribution queued offline to a goal also created offline | Mobile unit | Sent only once the goal has a server id; `goalId` moved into the URL | [syncEngine:352](../../mobile/src/services/sync/syncEngine.test.ts#L352), [entityAdapters:38](../../mobile/src/services/sync/entityAdapters.test.ts#L38), [:56](../../mobile/src/services/sync/entityAdapters.test.ts#L56) | Covered |
| TC-SAV-19 | rule 16 | The audit insert fails inside the contribution's transaction | Integration | The caller's write still commits (savepoint) | [integration.persistence:129](../../server/test/integration.persistence.test.ts#L129) (generic, not contribution-specific) | Covered |
| TC-SAV-20 | SAV-US-02 | Contribute while the goal's cancel is in flight | Integration (two DB transactions) | Waits on the goal row, then 409 `GOAL_NOT_ACTIVE`; no contribution | [integration.concurrency:155](../../server/test/integration.concurrency.test.ts#L155) | Covered |
| TC-SAV-21 | SAV-US-05 | Remove a transaction-backed contribution while its backing transaction is being deleted | Integration (two DB transactions) | No deadlock: the removal waits on the transaction row, then 404 `CONTRIBUTION_NOT_FOUND` | [integration.concurrency:264](../../server/test/integration.concurrency.test.ts#L264) | Covered |
| TC-SAV-22 | SAV-US-03 | List goals page by page (API-05); the app needs every goal | Integration + Mobile unit | Newest first with `meta.pagination`, no row repeated or skipped across pages; the app follows `hasMore` to the last page | [integration.goals:139](../../server/test/integration.goals.test.ts#L139), [collectPages:17](../../mobile/src/services/api/collectPages.test.ts#L17), [:25](../../mobile/src/services/api/collectPages.test.ts#L25), [:32](../../mobile/src/services/api/collectPages.test.ts#L32) | Covered |
| TC-SAV-23 | SAV-US-05 | Remove contributions after the wallet is archived | Integration | Transaction-backed: 409 `WALLET_ARCHIVED`, backing transaction still `COMPLETED`; earmark: 204 (§6.5, §13.8) | [integration.goals:237](../../server/test/integration.goals.test.ts#L237) | Covered |
| TC-SAV-24 | SAV-US-04, SAV-US-06 | Edit or cancel a goal from the app while offline | Mobile unit | The queued edit is sent as `PATCH /goals/{id}` and the queued cancel as `DELETE /goals/{id}`, each with its own idempotency key | [entityAdapters:131](../../mobile/src/services/sync/entityAdapters.test.ts#L131), [entityAdapters:102](../../mobile/src/services/sync/entityAdapters.test.ts#L102) | Covered |
| TC-SAV-25 | SAV-US-01, SAV-US-04 | Deadline quick options counted from a day: mid-month, month-end (Aug 31, Feb 29), December | Mobile unit | End of month, in 3/6 months, end of year, in 1/2 years; a month-end day clamps to a shorter month's last day; December keeps only "end of this year"; never before the day | [goalDeadlines:11](../../mobile/src/features/goals/goalDeadlines.test.ts#L11), [:22](../../mobile/src/features/goals/goalDeadlines.test.ts#L22), [:29](../../mobile/src/features/goals/goalDeadlines.test.ts#L29), [:34](../../mobile/src/features/goals/goalDeadlines.test.ts#L34) | Covered (sheet itself not driven on a device) |
| TC-SAV-26 | SAV-US-03 | Planning's goal list with active, completed and cancelled goals; an active goal past its target date, one due today, an undated one; a completed goal past its date | Mobile unit | Grouped In progress → Completed → Cancelled, list order kept inside each, headings only when two or more groups have goals; Overdue only for the active goal past its date | [planningSections:26](../../mobile/src/features/planning/planningSections.test.ts#L26), [:32](../../mobile/src/features/planning/planningSections.test.ts#L32), [:46](../../mobile/src/features/planning/planningSections.test.ts#L46) | Covered (screen not driven on a device) |

## Gaps, by risk

None open.
