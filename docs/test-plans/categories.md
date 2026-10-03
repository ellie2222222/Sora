# Test plan: Categories

**Stories:** SRS §9 CAT-US-01 Read the tree · CAT-US-02 Add · CAT-US-03 Rename/restyle · CAT-US-04 Archive
**Contract:** API spec §10 Categories
**Rules:** AC-01 (another wallet's category reads as absent), VL-02 (`uq_category_name_per_parent` + service check for a clean 409), VL-03; starter categories seeded at registration (AUTH-US-01, migration 006)
**Code under test:** `server/src/categories/`, `server/src/transactions/transaction-category.ts`, `packages/contracts/src/starter-categories.ts`, `mobile/src/features/categories/`, `mobile/src/services/guest/guestCategories.ts`, `mobile/src/services/guest/guestSeed.ts`

## Objectives

1. Categories never leak across wallets.
2. The tree stays summable: a child has its parent's type and wallet, there are no cycles, and sibling names are unique ignoring case.
3. Archiving never breaks history or an active budget.

## Test data & environment

- Each registered probe user has its own seeded categories; `categoryOf(api, user, walletId, type)` picks one ([probe-data.ts:65](../../server/test/support/probe-data.ts#L65)).
- `integration.categories.test.ts`: one user and one account in `before()`; every category is created per test with a `probe-<uuid>` name, so tests never share a tree.
- Guest tests build trees through `guestCategoriesApi` on in-memory storage ([guest/testSupport.ts](../../mobile/src/services/guest/testSupport.ts)).

## Test cases

| ID | Story | Scenario | Type | Expected result | Automated by | Status |
|---|---|---|---|---|---|---|
| TC-CAT-01 | CAT-US-01 | Use or edit another wallet's category | Unit + Integration | 404 `CATEGORY_NOT_FOUND`, the same as a made-up id; checked before type and wallet | [transaction-category:44](../../server/test/transaction-category.test.ts#L44), [:49](../../server/test/transaction-category.test.ts#L49), [integration.access:59](../../server/test/integration.access.test.ts#L59), [integration.access:148](../../server/test/integration.access.test.ts#L148) | Covered |
| TC-CAT-02 | CAT-US-01 | `GET /categories` filtered by type and status; flat vs tree | Integration | Only matching rows; children under parents; ARCHIVED excluded by default | [integration.categories:44](../../server/test/integration.categories.test.ts#L44) | Covered |
| TC-CAT-03 | CAT-US-02 | Create under a parent of the other type, or in another wallet | Integration | 422 `CATEGORY_WRONG_TYPE` / 403 `CATEGORY_WRONG_WALLET` | [integration.categories:66](../../server/test/integration.categories.test.ts#L66); guest copy: [guestCategories:70](../../mobile/src/services/guest/guestCategories.test.ts#L70) | Covered |
| TC-CAT-04 | CAT-US-02 | Category as its own parent; longer cycle | DB probe + Integration | Self-parent rejected by `chk_category_not_own_parent`; HTTP `CATEGORY_CYCLE` | [001_constraints:179](../../db/tests/001_constraints.sql#L179), guest copy [guestCategories:80](../../mobile/src/services/guest/guestCategories.test.ts#L80) | Covered — no HTTP path can form a longer cycle: `parentId` is immutable (§10.3) and a new row has no children |
| TC-CAT-05 | CAT-US-02 | Sibling with the same name in another case | DB probe + Integration | `uq_category_name_per_parent` rejects; same name in another wallet allowed; HTTP 409 `CATEGORY_DUPLICATE_NAME` | [001_constraints:164](../../db/tests/001_constraints.sql#L164), [:169](../../db/tests/001_constraints.sql#L169), [:174](../../db/tests/001_constraints.sql#L174), [integration.categories:81](../../server/test/integration.categories.test.ts#L81), guest copy [guestCategories:47](../../mobile/src/services/guest/guestCategories.test.ts#L47), [:55](../../mobile/src/services/guest/guestCategories.test.ts#L55) | Covered |
| TC-CAT-06 | CAT-US-02 | Create is audited; VIEWER create | Integration | Audit row; VIEWER 403 | [integration.categories:91](../../server/test/integration.categories.test.ts#L91) | Covered |
| TC-CAT-07 | CAT-US-03 | Rename onto a sibling; re-case own name; change type or parent | Integration | 409 `CATEGORY_DUPLICATE_NAME`; re-casing allowed; type and parent unchanged | [integration.categories:101](../../server/test/integration.categories.test.ts#L101); guest copy: [guestCategories:91](../../mobile/src/services/guest/guestCategories.test.ts#L91) | Covered |
| TC-CAT-08 | CAT-US-04 | Archive a parent with children, by `DELETE` or by `PATCH {status: ARCHIVED}`; archive while an active budget uses it; archive after that budget is archived | Integration + Mobile unit | Subtree archived either way; 409 `CATEGORY_IN_USE`; then allowed | [integration.categories:116](../../server/test/integration.categories.test.ts#L116); guest copy: [guestCategories:114](../../mobile/src/services/guest/guestCategories.test.ts#L114), [:121](../../mobile/src/services/guest/guestCategories.test.ts#L121), [:129](../../mobile/src/services/guest/guestCategories.test.ts#L129), [:138](../../mobile/src/services/guest/guestCategories.test.ts#L138), budget on a child: [integration.categories:148](../../server/test/integration.categories.test.ts#L148), guest [guestCategories:151](../../mobile/src/services/guest/guestCategories.test.ts#L151) | Covered |
| TC-CAT-09 | CAT-US-04 | Historical transaction on an archived category | Integration | The transaction still reads with its category | [integration.categories:163](../../server/test/integration.categories.test.ts#L163) | Covered |
| TC-CAT-10 | AUTH-US-01 | Starter categories | Unit + Integration | Valid, unique ignoring case, at least one INCOME and one EXPENSE; seeded on register | [starter-categories:11](../../packages/contracts/test/starter-categories.test.ts#L11)–[:38](../../packages/contracts/test/starter-categories.test.ts#L38), [integration.auth:20](../../server/test/integration.auth.test.ts#L20) | Covered |
| TC-CAT-11 | GST-US-01 | Guest seeding and versioned backfill | Mobile unit | Seeds every starter; backfills once per version; skips a name already used at the root; doesn't add "Other Expense" beside "Other" | [guestSeed:31](../../mobile/src/services/guest/guestSeed.test.ts#L31)–[:69](../../mobile/src/services/guest/guestSeed.test.ts#L69) | Covered |
| TC-CAT-12 | offline | Permanent delete of an unused category, queued offline | Mobile unit | Allowed only with no transactions in the subtree; routed to permanent delete, not archive; a server refusal parks the row | [guestCategories:173](../../mobile/src/services/guest/guestCategories.test.ts#L173), [:188](../../mobile/src/services/guest/guestCategories.test.ts#L188), [:203](../../mobile/src/services/guest/guestCategories.test.ts#L203), [syncEngine:368](../../mobile/src/services/sync/syncEngine.test.ts#L368), [:380](../../mobile/src/services/sync/syncEngine.test.ts#L380), [entityAdapters:119](../../mobile/src/services/sync/entityAdapters.test.ts#L119) | Covered |
| TC-CAT-13 | DASH-US-01 | Dashboard groups child categories under their parent | Mobile unit | Children summed under the parent; ordered by group total | [dashboardAnalytics:95](../../mobile/src/utils/dashboardAnalytics.test.ts#L95)–[:135](../../mobile/src/utils/dashboardAnalytics.test.ts#L135) | Covered |
| TC-CAT-14 | API §10.4 | `DELETE /categories/{id}?mode=permanent` on a category with transactions (or a child with them); on an unused one | Integration | 409 `CATEGORY_HAS_TRANSACTIONS`; unused: 204, row gone, `CATEGORY_DELETED` audit row (not `CATEGORY_ARCHIVED`) | [integration.categories:173](../../server/test/integration.categories.test.ts#L173); client side: TC-CAT-12 | Covered |
| TC-CAT-15 | CAT-US-03 | Restore a child while its parent is archived; restore the parent, then the child | Integration + Mobile unit | 409 `CATEGORY_PARENT_ARCHIVED`, child stays archived; after the parent, 200 | [integration.categories:135](../../server/test/integration.categories.test.ts#L135), guest copy [guestCategories:160](../../mobile/src/services/guest/guestCategories.test.ts#L160) | Covered |
| TC-CAT-16 | CAT-US-02 | Create a child while its parent's archive is in flight | Integration (two DB transactions) | Waits on the parent row, then 409 `CATEGORY_PARENT_ARCHIVED` | [integration.concurrency:195](../../server/test/integration.concurrency.test.ts#L195) | Covered |
| TC-CAT-17 | CAT-US-04 | Permanently delete a category an archived budget still names | Integration | 409 `CATEGORY_IN_USE`, not a 500 from the foreign key | [integration.concurrency:305](../../server/test/integration.concurrency.test.ts#L305) | Covered |

## Gaps, by risk

`integration.categories` (2026-10-02) closed TC-CAT-02..09 and TC-CAT-14. Writing TC-CAT-08 found that `PATCH {status: ARCHIVED}` skipped both the `CATEGORY_IN_USE` guard and the child cascade, on the server and in the guest copy. Both are fixed, and API spec §10.3 now says so. Restoring a child under an archived parent is now refused (`CATEGORY_PARENT_ARCHIVED`, TC-CAT-15).

None open.
