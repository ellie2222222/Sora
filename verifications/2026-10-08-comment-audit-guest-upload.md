# Double-check with a comment audit of the guest upload rework

**Date:** 2026-10-08T04:48:59Z
**Method:** double-check skill, with the comment-audit skill
**Verdict:** PASS
**Scope:** every file of the guest upload rework:
- `mobile/src/services/guest/guestUpload.ts`, `guestUploadTask.ts` and their tests;
- the `AuthProvider` and `RootNavigator` changes;
- `mobile/src/features/guest/` (screen, components, hooks);
- the `syncRing` token in `sizes.ts`.

**Files touched:**
- `mobile/src/services/guest/guestUpload.ts`
- `mobile/src/features/guest/components/{SyncRing,UploadProgressBar,UploadStepsCard,GuestUploadIndicator}.tsx`
- `mobile/src/features/guest/components/useSvgId.ts` (new)
- `mobile/src/features/guest/screens/GuestUploadScreen.tsx`

**Related reports:** 2026-10-08-guest-upload-background-cancel.md (follows up; no open follow-ups carried); 2026-10-05-comment-audit-editable-transactions.md (last comment audit; no overlap)

## Method

- **Comment policy:** CLAUDE.md Part 7 rule 11, re-read for this pass.
- **Comments read:**
  - every comment in the new files;
  - every comment the rework added to existing files (`git diff -U0`).
- **Removed names:** searched for `resolveGuestUpload`, `UploadProgressCallback`, `onProgress`, `uploadedItemCounts`, `uploadingTitle` and `completedPhases` (repo-wide, excluding `node_modules`, `mobile/android` and `webpage`).
- **Translation keys:** a usage count for each new `guest.upload.*` key.
- **Gradient-id claim:** checked whether web is a target (`react-native-web` dependency, `web` script, `app.json` `web` block).
- **Checks:** `npm run typecheck`, `npm run test -w @sora/mobile`.

## Findings

1. **Animation narration (pattern 8), removed:**
   - `UploadProgressBar.tsx`: the component doc "A thin bar whose fill eases to each new value, with a faint halo and, while running, a passing highlight." Deleted.
   - `UploadStepsCard.tsx`: the card doc "A raised card listing every step: finished ones settled, the running one lit, the rest waiting their turn." Deleted.
   - `UploadStepsCard.tsx`: "The spinner whips round once more as it fades, then the check springs in with a short ring." Deleted.
   - `GuestUploadScreen.tsx`: the `AnimatedEllipsis` doc "Three dots that fill in turn while the upload runs; a plain ellipsis under Reduce Motion." Deleted; the Reduce Motion branch is plain in the code.
2. **Prop docs that narrated visuals, rewritten as the contract:**
   - `SyncRing.tsx` `active`: was "Running: the comet circles and the halo breathes. Paused: everything holds still." Now "Motion runs only while the upload does, so a still ring means nothing is being sent."
   - `UploadProgressBar.tsx` `active`: was "Running: a highlight sweeps along the filled part." Now "The passing highlight shows only while the upload runs."
3. **Restates the code (pattern 1), removed:** `guestUpload.ts` "// Then every contribution." above the contributions loop.
4. **Stale or misshapen comments (pattern 4), fixed:**
   - `guestUpload.ts` header: one over-long merged line reflowed. "a retry after an app kill" now reads "a retry after a cancel or an app kill", since cancel resumes the same way.
   - `GuestUploadIndicator.tsx` header: rewritten to the one non-obvious fact. It stays mounted (by `RootNavigator`) even while not visible, so it can confirm an upload that finished in the foreground.
5. **Duplicated "why" plus duplicated code (flag-only pattern, and double-check item 2):**
   - "Gradient ids resolve document-wide on some renderers…" was in `SyncRing.tsx` and `UploadProgressBar.tsx`.
   - The same `useId().replace(/\W/g, '')` expression was in four places.
   - The claim was vague. Checked: web is a target (`react-native-web ~0.21.0`, the `web` script, `app.json` `web`), and in a browser an SVG `url(#id)` resolves across the document.
   - Fixed with a small code change, outside the comment-only scope, made under double-check:
     - extracted `useSvgId(prefix)` into `features/guest/components/useSvgId.ts`, carrying the one precise comment;
     - the four call sites use it, and the copied comments are gone.
6. **Missing comments, added:**
   - `SyncRing.tsx` and `UploadStepsCard.tsx`: `useSharedValue(1)` for `burst` looked arbitrary.
   - Added "1 is the resting state: no motes/ring until a step completes." The source is the code itself: `opacity` reads 0 when `burst.value >= 1`.
7. **Kept as valid "why" comments (no change):**
   - `guestUploadTask.ts`: header, status doc, generation guard, start and reset contracts.
   - `guestUpload.ts`: `stopWhenAborted`, `uploadStatusOf`, `settleGoalStatuses`, `UPLOAD_PHASES`, the closing-step row.
   - `UploadStepsCard.tsx`: the iOS shadow-clipping note and the done → next sequencing delay.
   - `SyncRing.tsx`: the light-mode comet head.
   - `AuthProvider.tsx`: session reset and the stale-cache note.
   - The screen's `savedTarget` note.
   - The test helper doc.
8. **Removed names:** no matches. PASS.
9. **Translation keys:** all 17 `guest.upload.*` keys the screen and indicator use (16 new plus the reused `uploading`) have exactly one usage. PASS.
10. **Checks:** typecheck clean; mobile 678/678 (including `tokens-usage` and the Pressable function-style check). PASS.

## Fixes Applied

- Comment-only edits:
  - `guestUpload.ts` (findings 3, 4);
  - `UploadProgressBar.tsx`, `UploadStepsCard.tsx`, `GuestUploadScreen.tsx` (finding 1);
  - `SyncRing.tsx`, `UploadProgressBar.tsx` (finding 2);
  - `GuestUploadIndicator.tsx` (finding 4);
  - `SyncRing.tsx`, `UploadStepsCard.tsx` (finding 6).
- Code change: `useSvgId.ts` (new), plus four call sites and their `useId` imports (finding 5).
- Re-verified with `npm run typecheck` and `npm run test -w @sora/mobile` (678/678).

## Follow-ups

None.
