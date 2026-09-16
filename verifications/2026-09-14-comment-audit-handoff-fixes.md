# Comment audit: this session's HANDOFF.md fix (FAB/add-action bugs)

**Date:** 2026-09-14T10:28:30Z
**Method:** comment-audit skill, scoped to the four files just changed while resolving `HANDOFF.md`
(the most recently discussed work, per Phase 0's fallback rule — nothing else was named). Not a
full-repo re-sweep: [2026-09-12-comment-audit.md](2026-09-12-comment-audit.md) already covered the
whole tree two days ago and nothing in this scope predates that pass.
**Verdict:** PASS (one gap filled; one comment kept as-is after re-checking it against the policy)
**Governing policy:** CLAUDE.md Part 7 rule 11 (why not what; 1-2 lines; no debug-journal prose),
read fresh this run.
**Scope:** `mobile/src/features/transactions/components/TransactionListScreen.tsx`,
`mobile/src/features/dashboard/screens/HomeScreen.tsx`,
`mobile/src/features/goals/screens/GoalsScreen.tsx`,
`mobile/src/features/budgets/screens/BudgetsScreen.tsx`
**Files touched:** [TransactionListScreen.tsx:102](../mobile/src/features/transactions/components/TransactionListScreen.tsx#L102)
**Related reports:** [2026-09-14-handoff-fab-and-nativewind.md](2026-09-14-handoff-fab-and-nativewind.md)
(the fix this audits), [2026-09-12-comment-audit.md](2026-09-12-comment-audit.md)

## Findings

### Gap filled — a magic number with no stated reason

`TransactionListScreen.tsx`'s new `contentContainerStyle={{ ..., paddingBottom: fabBottomOffset + 96
}}` introduced `96` with nothing explaining where it comes from — exactly the "magic
number/threshold with no visible justification" shape this skill's "what's missing" section calls
out. The real reason is recoverable (I derived it while writing the fix, not guessing after the
fact): it clears the `Fab`'s own footprint — `56` (its default `size`) + `theme.spacing.md` (`12`,
its own `bottom` margin) — plus breathing room. **Added**: a one-line comment stating that
derivation, so a future reader doesn't have to reverse-engineer `Fab.tsx`'s own layout to trust the
number.

### Checked and kept — `HomeScreen.tsx`'s new `fabBottomOffset={0}` comment

```tsx
// CustomTabBar is a normal-flow sibling (`position: 'relative'`), not
// an overlay, so this screen already stops right above it — no extra
// offset needed to clear it (unlike the old global FAB this replaced).
fabBottomOffset={0}
```

Re-checked this against the policy rather than assuming my own just-written comment is automatically
fine: it explains a genuinely non-obvious fact (why a value that looks like it needs the tab bar's
height added actually needs none), not what the line does — a legitimate "why," matching the "magic
value that looks arbitrary or wrong without the comment" keep-category. Three lines is a little over
the usual 1-2 line guidance, but it's the minimum needed to prevent literally re-introducing the
shipped-then-reverted regression `HANDOFF.md` describes; kept as-is.

### Checked and clean

- No comments were added to `GoalsScreen.tsx` or `BudgetsScreen.tsx` — the new `ListHeaderComponent`
  blocks (a permission check gating a `Plus` icon) are self-evident from the code, and adding a
  comment would itself be a restates-the-code violation.
- The pre-existing comment in `TransactionListScreen.tsx` (`Guest mode has one wallet and never
  receives a walletId filter...`) is untouched by this pass and remains a genuine why-comment.
- No `TODO`/`FIXME`, no commented-out code, no stale comments found in the four files.

### Noted, not this skill's scope

`TransactionListScreen.tsx:2-3` imports `Calendar` from `lucide-react-native` and `Pressable` from
`react-native`, and neither is used anywhere in the file (pre-existing, not introduced by this
pass). That's dead code (an unused import), not a comment issue — flagging it as a follow-up for a
future double-check pass rather than touching it here, since this skill's edits must be
comment-only.

## Fixes Applied

1. [TransactionListScreen.tsx:102](../mobile/src/features/transactions/components/TransactionListScreen.tsx#L102) —
   added a one-line comment explaining the `+ 96` magic number. Comment-only: verified the diff adds
   nothing but a `//` line above the unchanged `contentContainerStyle` prop; re-ran `npm run
   typecheck -w @sora/mobile` (clean) to confirm the comment doesn't break JSX attribute parsing.

## Follow-ups

- `TransactionListScreen.tsx:2-3` — unused `Calendar`/`Pressable` imports, pre-existing. Not a
  comment issue; carried forward for a future double-check/dead-code pass.
- Everything already open in [2026-09-12-comment-audit.md](2026-09-12-comment-audit.md) and
  [2026-09-14-handoff-fab-and-nativewind.md](2026-09-14-handoff-fab-and-nativewind.md) stands
  unchanged (not re-scoped into this pass).
