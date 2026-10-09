---
name: readability-audit
description: >-
  Finds and fixes app text that is too small for its tone -- muted or faint text at caption/label
  sizes, opacity stacked on already-quiet text, text allowed to shrink below its floor -- using the
  repo's own type-size-and-tone rule, then locks the result with a scan test. Use when text is "too
  small", "hard to read", "too grey/faint", "low contrast", when reviewing UI another agent wrote, and
  before calling new or changed UI done. React Native app text only -- distinct from the vendored
  Front-End Checklist `font-size`/`color-contrast` skills (web CSS) and from `double-check` (general
  code health).
---

# Readability Audit

AI-written UI demotes secondary text by shrinking it *and* greying it at once. Each step looks
reasonable, but the result is 11px grey text that passes a contrast test and still can't be read. This
skill holds every piece of text to a size floor for its tone.

Read the repo's design rules fresh every run: the conventions doc (`CLAUDE.md` or equivalent) and the
design guidelines it points to. The floors live there, as a rule pairing each text tone with its smallest
size. Apply them as written; never restate or loosen them in this file. If the
repo has no such rule, stop and propose one to the user before sweeping.

## Non-negotiable constraints

- **A shared default changes only with the user's go-ahead.** Ask before changing a size token, the
  text component's variant-to-size map, or a shared primitive such as a section label. Say how many
  call sites move. Call-site fixes need no sign-off.
- **Never trade readability for colour.** A fix never drops a semantic colour (`income`, `danger`, …)
  to plain text, and never lowers contrast to keep a hierarchy.
- **Fixes are visual only.** Change size, tone, weight or the overriding `style`. No copy, layout logic
  or data changes ride along.
- **Don't change anything settings-backed to look at a screen.** If seeing it in another theme or
  language means changing a user preference the server stores, ask first, or switch it offline so
  the write never lands, then switch back.

## Phase 0 — Scope

- **Named** (a screen, a component, "the UI I just wrote"): only that.
- **Unscoped**: every file that renders text in the app.

Skim the newest report in the repo's verification directory for a previous run. Carry forward any
deliberate exceptions it records, rather than re-flagging them.

## Phase 1 — Find

1. **Resolve the rule's inputs from the code, not memory:**
   - the size scale (the font-size tokens);
   - the text component's variant-to-size map and its tone-to-colour map;
   - the muted and faint colour token names.
2. **Scan every text-rendering element.** Cover the text component, the money/amount component, and
   raw platform text. For each one, work out:
   - **effective size:** the variant's size, unless `style` overrides `fontSize`;
   - **effective tone:** the `tone` prop, unless `style` sets a text colour token, which wins;
   - **flags:** `opacity` < 1, `adjustsFontSizeToFit`/`minimumFontScale`, `allowFontScaling={false}`,
     `maxFontSizeMultiplier`.

   A tone or size chosen at runtime (`tone={x}`) is resolved by reading its possible values. Don't
   skip it.
3. **Check each element against the floors.** Classify each violation:
   - **call-site:** one element's own props or style;
   - **shared default:** caused by a variant or primitive whose default sits below a floor. Count
     its callers.
4. **Check the `xs` use rule** for text that passes the floors. A date, amount, name or instruction
   whose only appearance is at `xs` is a violation even in full-strength colour.

## Phase 2 — Fix

Choose per element by what the text *is*:

- **Secondary information** (a subtitle, metadata, a helper line): keep the tone and step the size up
  to the floor, e.g. `caption` → `label`.
- **A tight label** (a chart axis tick, a badge, a column in a fixed grid): keep the size and raise the
  tone. Faint → muted → default.
- **Opacity on quiet text:** remove the opacity. If the element still needs to look disabled, use the
  repo's disabled tokens.
- **Shrink-to-fit or font-scaling caps:** remove them. Fix the layout instead: allow wrapping, or drop
  secondary information, per the guidelines' density rule.
- **Shared default:** propose the change with its caller count and the screens that will shift. Wait
  for the go-ahead. Then make it once at the source, not at every caller.
  - Update everything sized from it, such as skeleton line heights keyed by variant.
  - Revisit callers that only stayed within their layout because the text was small.

Batch edits by file. Keep each fix visual only.

## Phase 3 — Verify

- **Re-scan.** Zero violations in scope, apart from user-approved exceptions, each written down with
  its reason.
- **Run the repo's checks.** Typecheck, plus the tests covering design tokens and colour pairs.
- **Look at it.** On a device or emulator at phone width, check every changed screen:
  - in both themes;
  - in the longest maintained locale;
  - with the system font scale raised once.

  Look for clipped text, rows that wrapped badly, overlapping chart labels, and skeletons that no
  longer match.
- **Lock it in once the full scope is clean.** Add a scan test beside the repo's existing token-usage
  test, checking the same floors, so the rule can't regress. Base the test on the scan from Phase 1,
  and never write it to pass while violations remain.

## Phase 4 — Report

Write the repo's dated verification report. Include:
- the scan method and the counts before and after, by size and tone;
- each shared-default change, with the user's go-ahead and the callers it moved;
- the call-site fixes, grouped by file;
- approved exceptions, with their reasons;
- the screens checked on the device, with the theme and locale used.

End with the chat summary in the repo's usual format for a change that touches files.
