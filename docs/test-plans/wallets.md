# Test plan: Wallets, members & invitations

**Stories:** SRS §9 WAL-US-01..13 (create, list, invite, preview, accept, revoke invitation, member list, change role, revoke member, hand ownership over, leave, archive, audit trail)
**Contract:** API spec §6 Wallets, §7 Members, §8 Invitations, §15 Audit, §2.5 Authorization
**Rules:** BR-01 (exactly one ACTIVE owner, `uq_wallet_single_owner`), BR-08 (invitations), AC-01 (non-member → 404), AC-04 (audit OWNER-only, append-only), LA-02 (membership changes audited), rule 3 (demote before promote), rule 6 (an invitation is not a member row)
**Code under test:** `server/src/wallets/`, `server/src/audit/`, `packages/contracts/src/enums.ts` (`roleSatisfies`), `mobile/src/features/wallets/`, `mobile/src/utils/roles.ts`

## Objectives

1. A wallet never has zero or two active owners, even under concurrent requests.
2. An invitation can be redeemed only by the person it was addressed to, once, within 7 days.
3. A non-member can't tell a wallet exists (404); a member below the required role gets 403.
4. Removing access keeps history attributable: membership rows are revoked, never deleted.

## Test data & environment

- `registerProbeUser` for each actor (owner, editor, viewer, stranger).
- `addMember(api, owner, walletId, invitee, role)` goes through the real invite-and-accept flow ([probe-data.ts:73](../../server/test/support/probe-data.ts#L73)).
- Expiry is simulated by updating `expires_at` on the probe's own invitation row by id.
- Database probes seed two fixed users and wallets inside a rolled-back transaction ([001_constraints.sql:43](../../db/tests/001_constraints.sql#L43)).

## Test cases

| ID | Story | Scenario | Type | Expected result | Automated by | Status |
|---|---|---|---|---|---|---|
| TC-WAL-01 | WAL-US-01 | Create a wallet; name empty or over 100 chars | Integration | 201 with the creator as OWNER, audited; bad name 422 | [integration.wallets:57](../../server/test/integration.wallets.test.ts#L57) | Covered |
| TC-WAL-02 | WAL-US-02 | List wallets as a user who owns one and is VIEWER on another; `includeOwn=false`, `includeShared=false`, a flag that is neither | Integration | Both listed with the caller's own role and relation label, balances per currency with no cross-currency total; a wallet with no membership absent; ARCHIVED only when asked; each flag excludes its side; any other value 422 | [integration.wallets:92](../../server/test/integration.wallets.test.ts#L92), [integration.wallets:390](../../server/test/integration.wallets.test.ts#L390) | Covered |
| TC-WAL-03 | WAL-US-03 | Invite with role OWNER | Unit + DB probe | Schema refuses; `chk_invitation_role` rejects | [schemas:241](../../packages/contracts/test/schemas.test.ts#L241), [schemas:248](../../packages/contracts/test/schemas.test.ts#L248), [001_constraints:122](../../db/tests/001_constraints.sql#L122) | Covered |
| TC-WAL-04 | WAL-US-03 | Create an invitation, then list invitations | Integration | Token returned once at creation; only its SHA-256 hash stored; no `token` in the list | [integration.members:99](../../server/test/integration.members.test.ts#L99) | Covered |
| TC-WAL-05 | WAL-US-03 | Re-invite an address with an open offer, in another case | Integration + DB probe | 409 `INVITATION_ALREADY_OPEN`; `uq_wallet_invitation_open` rejects | [integration.members:99](../../server/test/integration.members.test.ts#L99), [001_constraints:132](../../db/tests/001_constraints.sql#L132) | Covered |
| TC-WAL-06 | WAL-US-03 | Invite someone who is already an active member | Integration | 409 `MEMBER_ALREADY_EXISTS` | [integration.wallets:132](../../server/test/integration.wallets.test.ts#L132) | Covered |
| TC-WAL-07 | WAL-US-03 | EDITOR or VIEWER tries to invite | Integration | 403 `FORBIDDEN` | [integration.access:115](../../server/test/integration.access.test.ts#L115) | Covered |
| TC-WAL-08 | WAL-US-04 | Preview a live invitation without signing in | Integration | 200; `invitedEmail` masked (local part hidden) | [integration.members:99](../../server/test/integration.members.test.ts#L99), [integration.wallets:145](../../server/test/integration.wallets.test.ts#L145) | Covered |
| TC-WAL-09 | WAL-US-04 | Preview a revoked, expired or used token | Integration | Revoked/unknown 404; expired 410; used 409 | revoked: [integration.members:156](../../server/test/integration.members.test.ts#L156); unknown, expired, used: [integration.wallets:162](../../server/test/integration.wallets.test.ts#L162) | Covered |
| TC-WAL-10 | WAL-US-05 | Accept while signed in as a different address | Integration | 403 `INVITATION_EMAIL_MISMATCH`; no membership | [integration.members:99](../../server/test/integration.members.test.ts#L99) | Covered |
| TC-WAL-11 | WAL-US-05 | Accept the same token twice | Integration | First 200; second 409 `INVITATION_ALREADY_USED` | [integration.members:99](../../server/test/integration.members.test.ts#L99) | Covered |
| TC-WAL-12 | WAL-US-05 | Accept after expiry | Integration | 410 `INVITATION_EXPIRED`; no membership row | [integration.members:132](../../server/test/integration.members.test.ts#L132) | Covered |
| TC-WAL-13 | WAL-US-03 | Invite again while the earlier offer has expired but isn't revoked | Integration | 201; the old offer retired and audited like a revoke; a live offer still blocks | [integration.members:142](../../server/test/integration.members.test.ts#L142) | Covered |
| TC-WAL-14 | WAL-US-05 | A removed member accepts a new invitation | Integration | One membership row, reinstated ACTIVE with the new role | [integration.members:168](../../server/test/integration.members.test.ts#L168) | Covered |
| TC-WAL-15 | WAL-US-05 | After accepting | Integration | Wallet appears in the accepter's `GET /wallets` with role and label; acceptance audited against the wallet | [integration.wallets:179](../../server/test/integration.wallets.test.ts#L179) | Covered |
| TC-WAL-16 | WAL-US-06 | Revoke an open invitation, then invite again | Integration + DB probe | 204; old token 404; a new invite 201 | [integration.members:156](../../server/test/integration.members.test.ts#L156), [001_constraints:137](../../db/tests/001_constraints.sql#L137), [:141](../../db/tests/001_constraints.sql#L141) | Covered |
| TC-WAL-17 | WAL-US-06 | Revoke an invitation that was already accepted | Integration | 409 `INVITATION_ALREADY_USED` | [integration.wallets:200](../../server/test/integration.wallets.test.ts#L200) | Covered |
| TC-WAL-18 | WAL-US-07 | VIEWER reads the member list | Integration | 200; each entry has name, email, role, label, status, joined date and no credential; REVOKED only when asked | [integration.access:96](../../server/test/integration.access.test.ts#L96), [integration.wallets:212](../../server/test/integration.wallets.test.ts#L212) | Covered |
| TC-WAL-19 | WAL-US-08 | Promote a member to OWNER via `PATCH …/members/{id}` | Integration | 422; still one owner | [integration.members:78](../../server/test/integration.members.test.ts#L78) | Covered |
| TC-WAL-20 | WAL-US-08/09/11 | Sole owner demotes, removes or leaves themselves | Integration | Each 409 `WALLET_LAST_OWNER`; owner unchanged | [integration.members:65](../../server/test/integration.members.test.ts#L65) | Covered |
| TC-WAL-21 | WAL-US-08 | Owner lowers EDITOR to VIEWER | Integration | The member's next write is 403; audit row carries old and new role | [integration.wallets:243](../../server/test/integration.wallets.test.ts#L243) | Covered |
| TC-WAL-22 | WAL-US-09 | Owner removes a member | Integration | The member then gets 404; the row stays `REVOKED` | [integration.access:134](../../server/test/integration.access.test.ts#L134) | Covered |
| TC-WAL-23 | WAL-US-10 | Hand ownership to an EDITOR | Integration | 200; the heir is the only active owner; `wallets.owner_user_id` updated; the old owner is EDITOR | [integration.members:33](../../server/test/integration.members.test.ts#L33) | Covered |
| TC-WAL-24 | WAL-US-10 | Two concurrent handovers by the same owner | Integration | One 200, one 403; exactly one owner, not the original | [integration.members:47](../../server/test/integration.members.test.ts#L47) | Covered |
| TC-WAL-25 | WAL-US-10 | Hand over to a non-member or a revoked member | Integration | `MEMBER_NOT_FOUND` | [integration.wallets:269](../../server/test/integration.wallets.test.ts#L269) | Covered |
| TC-WAL-26 | WAL-US-11 | An EDITOR leaves | Integration | Own membership REVOKED; wallet gone from their list; their transactions still name them; audited | [integration.wallets:287](../../server/test/integration.wallets.test.ts#L287) | Covered |
| TC-WAL-27 | WAL-US-12 | Owner archives, then renames, a wallet | Integration | Data readable; new writes 409 `WALLET_ARCHIVED`; a cross-wallet transfer still readable from the other wallet; both audited | [integration.ledger:148](../../server/test/integration.ledger.test.ts#L148) | Covered |
| TC-WAL-28 | WAL-US-13 | Read the audit trail as each role | Integration | OWNER 200; EDITOR and VIEWER 403; non-member 404 | [integration.access:115](../../server/test/integration.access.test.ts#L115), [integration.access:59](../../server/test/integration.access.test.ts#L59) | Covered |
| TC-WAL-29 | WAL-US-13 | Trail contents and filters | Integration | Denied attempts listed with successes; a cross-wallet transfer in both trails; filter by event and date; paged | cross-wallet: [integration.ledger:76](../../server/test/integration.ledger.test.ts#L76) (SQL); filters, paging: [integration.wallets:326](../../server/test/integration.wallets.test.ts#L326); denials: [integration.wallets:361](../../server/test/integration.wallets.test.ts#L361) | Covered |
| TC-WAL-30 | BR-01 | Owner and membership constraints written directly | DB probe | Second ACTIVE owner rejected; owner revocable; new owner once the old is REVOKED; duplicate member and unknown role rejected | [001_constraints:87](../../db/tests/001_constraints.sql#L87), [:92](../../db/tests/001_constraints.sql#L92), [:97](../../db/tests/001_constraints.sql#L97), [:102](../../db/tests/001_constraints.sql#L102), [:108](../../db/tests/001_constraints.sql#L108), [:113](../../db/tests/001_constraints.sql#L113) | Covered |
| TC-WAL-31 | §2.5 | Role ranking used by every guard and by the app | Unit + Mobile unit | `roleSatisfies` grants a role and everything above it; no membership grants nothing; unknown role denies; app permissions match | [enums:13](../../packages/contracts/test/enums.test.ts#L13), [enums:25](../../packages/contracts/test/enums.test.ts#L25), [enums:31](../../packages/contracts/test/enums.test.ts#L31), [enums:53](../../packages/contracts/test/enums.test.ts#L53), [roles:9](../../mobile/src/utils/roles.test.ts#L9), [roles:19](../../mobile/src/utils/roles.test.ts#L19) | Covered |

## Gaps, by risk

None open. TC-WAL-29 found 403s missing from the trail; a member's 403 is now audited as `ACCESS_DENIED` (`all-exceptions.filter.ts`, API spec §16.1). The suite also found `?includeOwn=false` read as true (`z.coerce.boolean`); query flags now go through `common/query-flag.ts`, as does categories' `?tree=`.

## Running

```bash
DATABASE_URL=postgresql://…/scratch_wal npm run test -w @sora/server   # integration.members, integration.access, integration.wallets
npm run db:test                                                          # 001_constraints.sql
```
