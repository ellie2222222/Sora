# Per-account SQLite read cache, kept across logout, with a warning when another account's data is on the device

**Date:** 2026-09-24T09:55:00Z
**Method:** ad hoc
**Verdict:** PASS (typecheck, unit tests, bundle). Not driven on a device or against a live server.
**Scope:** the online-first design agreed with the user. The server is the source of truth, and the device keeps each account's last server responses in SQLite, used offline. Logout keeps them. A login that finds another account's data warns and keeps it hidden. Offline writes keep queueing, and the guest-upload flow is unchanged.

**Files touched:**
- **Cache:** `mobile/src/services/sync/{localCache,localCache.test,localCacheDb,localCacheInstance,offlineQueue,offlineQueue.test,index}.ts`
- **Read path:** `mobile/src/app/store/api/{signedInRead,signedInRead.test,guestFallback}.ts`, plus 9 `*Api.ts` files (cache keys on every read)
- **Store:** `mobile/src/app/store/{localCacheMiddleware,index}.ts`
- **App shell:** `mobile/src/app/providers/AuthProvider.tsx`, `mobile/src/app/navigation/RootNavigator.tsx`
- **Locales:** `mobile/src/app/i18n/locales/{en,vi}.ts`
- **Docs:** `SDS.md` §4.4, `CLAUDE.md` rule 17

**Related reports:** `2026-09-24-refresh-logout-and-offline-queue-gaps.md`, `2026-09-24-offline-reads-and-compose.md`

## Design as built

- **Storage:** two new tables in the existing `sora_sync.db`.
  - `cached_responses(owner_user_id, cache_key, json, saved_at)` is capped at 1000 rows per account, dropping the oldest first.
  - `device_accounts(user_id, email, last_seen_at)`.
  - On web both are in memory only.
- **Saving:**
  - `readSignedIn` saves every successful signed-in read under `cacheKeyOf(endpoint, arg, page)`. The key is a stable JSON of the argument, so a read and a patch agree on it.
  - `localCacheMiddleware` saves the patched list whenever `queryResultPatched` fires, which is how an offline write shows up in a list. That lets a queued row be listed after a restart.
  - A failed save never fails the read.
- **Reading:** a network failure answers from the account's saved copy. Only when there is none does the network error rethrow. Server errors always rethrow.
- **Ownership:**
  - `adoptDeviceOwner` sets both the cache owner and the queue owner inside the session subscription, synchronously, from the token's `sub` claim.
  - It runs before any screen reads after a login. React runs child effects before parent effects, so an effect-based owner would have missed the first reads.
  - Guest mode and signed-out states have no owner, so nothing is saved or read.
- **Logout:** clears only the in-memory RTK Query cache. The saved copy and any unsynced writes stay on the device.
- **Warning:**
  - After login, register or Google sign-in, the app remembers the account's email.
  - It then lists other accounts that have saved reads or open queue rows (`ownersWithOpenRows`).
  - If there are any, `RootNavigator` shows a `ConfirmDialog` with their masked emails (`a•••@example.invalid`). **Continue** dismisses it; **Log out** signs the new account out.
  - The same account logging back in gets no warning.
  - A failure here never fails the login.

## Findings

1. **Isolation between accounts:** the tests show that a saved copy is unreadable once another account is the owner, and readable again when the owner returns. With no owner, nothing is saved or read. PASS.
2. **Key stability:** argument key order and `undefined` fields don't change the key; endpoints, arguments and pages all separate. Infinite queries save one row per loaded page. PASS.
3. **Read fallback:**
   - a success saves;
   - a network failure returns the saved copy;
   - a server error rethrows even when a saved copy exists;
   - a failed save still returns the fresh data.

   PASS.
4. **Cap:** 1001 saves drop the oldest row. PASS.
5. **Other-account detection:** it counts accounts with cached reads and accounts with only open queue rows, and excludes the signed-in account. `ownersWithOpenRows` ignores synced rows. PASS.
6. **Checks:**
   - `npx tsc --noEmit`: exit 0.
   - `npm run test` in `mobile/`: 373/373 (+14 new).
   - `npx expo export --platform android`: bundled (3763 modules).
   - i18n: 409/409 keys, no drift.

7. **In-flight read across an account switch (found 2026-09-25):**
   - `save` read the owner at save time. A's read still in flight when B logged in would have been saved under B's account.
   - Fix: `LocalCache.entry(key)` binds the owner when the read starts. `readGuestOrApi`, `auditApi` and `membersApi` use it.
   - The middleware keeps `save`, because a patch runs synchronously under the current owner.
   - Regression test: "saves a read under the account that started it…". `npx tsc --noEmit`: exit 0; `npm run test`: 374/374. PASS.

## Follow-ups

- **Device check:**
  - signed in and online, then offline: screens keep their data, including after killing the app;
  - a queued write is still listed after a restart;
  - log out, log in as another account: the warning appears, and only the new account's data shows;
  - log back in as the first account: its data and queued writes return.
- **At-rest encryption:** financial data in `sora_sync.db` is plain SQLite. Android backup is off, but anyone with root or physical access to the device could read it. SQLCipher, or an OS-level secure container, is the fix if that matters.
- **Offline totals:** balances and totals from the saved copy are what the server last said. Queued writes don't move them until they sync (unchanged).
- **Freshness indicator:** a "last updated" note on screens showing a saved copy is not built. `saved_at` is stored, so the data for it exists.
- **Translator review:** the 3 new vi strings (`auth.otherAccountData*`).
