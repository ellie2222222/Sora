---
name: extract-modules
description: >-
  Sweeps screens and feature components for code that belongs in its own dedicated file — a duplicated
  or oversized inline sub-component, a label/icon map or enum-like constant, an interface or type used
  across files, a pure helper, or a hook — then extracts it into the location this repo's own layout
  already uses for that kind of thing and re-points every caller. Use when asked to "split screens into
  reusable components", "extract components/utils/types", "find what can be split into dedicated
  files", "decompose this screen", or similar -- distinct from `restructure` (moves or renames whole
  files; this splits code out *of* files) and `double-check` (flags decomposition as one item among
  many and does not carry out the extraction).
---

# Extract Modules

Finds code living in the wrong place *inside* a file and gives it a file of its own, so the next screen
can reuse it instead of copying it. Every extraction preserves behavior exactly; this is a refactor, never
a redesign.

Read the repo's conventions doc (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, or a README section) fresh
every run. It decides where each kind of module lives, how barrels and import paths work, and which past
bugs an import change can reintroduce. Nothing below overrides it.

## Non-negotiable constraints

- **Behavior-preserving only.** Props, rendered output, testIDs, accessibility labels and translation keys
  stay identical. If two "duplicates" have drifted (one uses a different icon or key), unifying them is a
  behavior change — pick the correct one, and say which and why in the report.
- **Never create an import cycle.** Before adding an export to a barrel, check the conventions doc's barrel
  rule, and whether the new module's own imports close a loop back through that barrel.
- **No speculative abstraction.** Extract something used once only when its file is oversized or mixes
  concerns (see Phase 1). A shared primitive needs two or more real callers today.
- **Scope discipline.** Don't restyle, rename public APIs, or "improve" logic while moving it.

## Phase 0 — Scope

- **Named by the user** (a screen, a feature) — sweep only that.
- **Unscoped** — every screen and feature-component file, plus navigation and provider files. Say so
  before starting.
- Skim the most recent dated report (if the repo keeps them) for extraction work already done or
  deliberately declined, and carry its open items forward.

## Phase 1 — Find candidates

Delegate the read to a read-only exploration agent when the scope is large. Ask for
`file:line-range — kind — proposed destination — why (every duplicate's file:line)`, most valuable first.
Look for, in priority order:

1. **Duplication across files** — the same inline sub-component, style block, label or icon map,
   formatter, or conditional (e.g. a display-name rule) in two or more places. Grep every copy; list all.
2. **Pure logic inside a UI file** — a function with no hooks or JSX. It is testable, so it belongs in the
   shared utils location or a feature-local helper, with a test.
3. **Oversized inline sub-components** — more than about 30 lines, or rendered in a loop, inside a screen
   file. These move to that feature's components directory.
4. **Types and interfaces** declared in one file but imported by others.
5. **Magic values** repeated across files that should be one named constant — or that already have a
   helper the copies ignore.
6. **Misplaced files** — surface these, but hand them to `restructure` rather than moving them here.

Verify every candidate live before acting; a background agent's view can go stale.

## Phase 2 — Plan, then extract

- Group candidates into independent batches: one feature, or one shared primitive plus its callers.
  Present the plan (batch → files → destination) before editing, unless the user already asked for the
  work to be done.
- Destination: a shared primitive in the repo's shared components/utils/hooks location, exported through
  its barrel; feature-only code in that feature's own directory. Follow the repo's import rule for each
  (barrel from outside a directory, relative path inside it).
- Move the code verbatim, then re-point every caller, then delete the original. Grep for the old name
  afterward — zero leftovers.
- A pure helper gets a unit test in the repo's existing test style, even if its previous inline form had
  none.

## Phase 3 — Verify

- Run the repo's real typecheck and test commands, and a bundle/build if it has one. Discover them from
  its package manifests or CI config.
- Diff-review each batch: every moved line should be unchanged except import lines. Any other change needs
  a reason recorded in the report.
- Grep for the extracted names: each is defined once and imported where it was previously inlined.

## Phase 4 — Report

Record the pass in the repo's established report location and template, if it has one, dated from the
system clock. For each extraction: source → destination, callers re-pointed, tests added. List declined
candidates with the reason (a single use, a would-be cycle, drift that needs a product decision). Then
give a chat summary in the repo's usual format for a change that touches files.
