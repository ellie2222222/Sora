# New skills, the review-checklist rewrite, and the keypad column-width fix

**Date:** 2026-09-24T07:25:56Z
**Method:** ad hoc
**Verdict:** PASS (keypad: static only, not measured on a device)
**Scope:**
- the `i18n-audit` and `scratch-probe` skills, plus the reciprocal edit to `double-check`
- the `aif-sdlc-checklist.md` staleness check and rewrite
- the width of the `CalculatorKeypad` date key

**Files touched:**
- `.claude/skills/{i18n-audit,scratch-probe}/SKILL.md` (new)
- `.claude/skills/double-check/SKILL.md`
- `CLAUDE.md` (Project Skills table)
- `aif-sdlc-checklist.md`
- `mobile/src/components/CalculatorKeypad.tsx`

**Related reports:** `2026-09-24-skill-audit.md`, `2026-09-24-keypad-sheets-double-check.md`

## Findings

1. **The checklist was stale.** Checked against the repo:
   - **Section numbers:** stories are in SRS §9, not §7; the API is in `docs/API_SPECIFICATION.md` and SDS §5–6, not SDS §4; the schema is SDS §7 and the mapping SDS §8.
   - **Business rules:** it cited BR-01…BR-10, but SRS goes to BR-16.
   - **Things that don't exist:** repositories (0 `*.repository.ts`), Testcontainers (not a dependency), `deleted_at` (0 in 001), a "Constitution".
   - **Wrong roles:** `ADMIN`/`MEMBER` instead of OWNER/EDITOR/VIEWER.
   - **Deleted web stack:** shadcn, Zustand (banned by MB-02), DOM `id`s instead of `testID`, `localhost:9090`, SQLAlchemy's `joinedload`.
   - **Missing entirely:** the parity check, money-as-string, 404-vs-403, en/vi parity, rules 14–16, and every MB rule.
   - It was last reconciled in `bbf9a93`, and the stack changed after that.

   **Rewritten** around CLAUDE.md's seven DoD gates, with migration, mobile and code-review sections. The still-accurate pre-merge items were kept verbatim. Every command it names was checked: root `db:test`, `db:migrate`, `typecheck` and `test`, and mobile `test`/`typecheck`, all exist; `roleSatisfies` and `pg-types.ts` both resolve.
2. **Skills.** `i18n-audit` and `scratch-probe` were added, and `double-check`'s description now hands off to `extract-modules` and `scratch-probe`. All 10 project skills' frontmatter parses, with `name` matching the directory. `scratch-probe` avoids the "verify" name collision.
3. **Keypad date key wider than the operator pairs.** Each key sized itself with `flex: 1`. Flex shares out space only after subtracting each item's own padding and border:
   - the date key alone had `paddingHorizontal: xxs`, so it came out wider;
   - the operator-pair wrappers had no border while the digit keys had 1px, so the pairs came out narrower.

   **Fixed:** every column is now a padding- and border-free `KeyColumn` (`flex: 1`), and the key fills it. A keypad without a date key renders an empty fourth column, so the top row no longer stretches three keys across four columns.

## Verification

- `cd mobile && npx tsc --noEmit`: clean.
- `node --test src/utils/calculatorEngine.test.ts`: 34/34.
- `npx expo export --platform android`: bundled.

## Follow-ups

- Check the keypad on a device: equal column widths, and the empty top-right cell on Add Account.
- The 19 extraction candidates are still waiting on your go-ahead.
