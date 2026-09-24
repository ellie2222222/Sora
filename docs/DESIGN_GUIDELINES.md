# Mobile Design Guidelines

> Every screen, component, and state in `mobile/` follows these. Part 1 is product intent (what
> belongs on a screen and why); Part 2 is state architecture (how a screen behaves when data is
> loading, missing, or broken); Part 3 is the visual/interaction vocabulary (spacing, color,
> motion, copy); Part 4 is the check to run before calling UI work done. Defaults, not laws —
> override when the specific screen's context genuinely calls for it, and say why in a comment if
> the override isn't obvious.
>
> Tokens named here live in `mobile/src/design-system/` (`colors.ts`, `spacing.ts`, `radius.ts`);
> always use the token, never the literal value it currently resolves to.

---

## Part 1 — Product Principles

### Core principle

The UI must read as a **mature, intentional finance product**, not a generic generated SaaS
dashboard. In priority order: information clarity, fast interaction, financial context,
consistent hierarchy, functional visuals, low visual noise.

> **Don't make the UI look "modern." Make it look intentional.** Design clarifies financial
> information; it doesn't decorate it.

### Every element earns its place

A component exists because it communicates information, supports an action, helps navigation,
establishes hierarchy, or gives feedback. Anything that exists only because it "looks nice" goes.

Don't default to: card grids for every figure, glassmorphism, decorative gradients, glows or
blobs, heavy shadows, oversized KPI numbers, stacks of badges, an icon on every line, decorative
charts, "AI insight" panels, motivational copy, or invented scores.

```text
✗ ┌─────────┐ ┌─────────┐ ┌─────────┐        ✓ Income                    ₫30,000,000
  │ Income  │ │ Expense │ │ Net     │          Expenses                 -₫22,000,000
  └─────────┘ └─────────┘ └─────────┘          ──────────────────────────────────────
                                               Net                        ₫8,000,000
```

### Typography carries the hierarchy

Build hierarchy with size, weight, text opacity, spacing, alignment, position and hairline
dividers first — a container is the last tool, not the first. One or two sections per screen are
visually primary; giving every section equal weight means none is.

### Financial data presentation

- Amounts render through the `<Money>` component (sign, income/expense tone and tabular figures
  built in), or `formatMoneyString`/`formatScaled` (`mobile/src/utils/money.ts`) where a plain
  string is needed — never `Number(amount)` or a raw string (CLAUDE.md MB-08).
- Conventions: expense `-₫120,000`, income `+₫5,000,000` (`signDisplay: 'always'`), balance
  `₫12,450,000` (unsigned); `compact: true` for dense rows and chart labels.
- Transfers are visually distinct from both income and expense (`theme.colors.transfer`) and never
  counted in either (BR-06).
- Amounts are right-aligned in lists and use tabular figures (`<Text numeric>`, i.e. `numericFontVariant`) so
  columns of numbers line up digit-for-digit.
- Color is never the only carrier of financial state — pair it with the sign, a label, or
  position, so it survives color blindness and grayscale.
- Totals in different currencies are shown separately, never summed (BR-07).
- Not every number is a KPI. Reserve large type for the one figure the screen is about.

### Label every aggregate

The user must know at a glance whether a number is a month total, a day total, a single
transaction, an account balance, a budget, or goal progress. Stacking unlabelled numbers at
different aggregation levels is the most common way this screen family misleads.

```text
✗ Sep 2026                  -₫22,093,008        ✓ September
  Today · Sep 23            -₫22,093,000          Expenses                 ₫22,093,008
  Food                      -₫20,000,000
                                                  Today · Sep 23           ₫22,093,000
                                                  ──────────────────────────────────────
                                                  Food                    -₫20,000,000
```

### Transaction lists are a ledger

Rows, not floating cards. Hierarchy per row: category/merchant → account → amount → optional
metadata. Group by day with a labelled day subtotal.

```text
Today · Sep 23                          -₫93K
────────────────────────────────────────────
Other                                   -₫93K
Cash

Food                                    -₫20M
Cash
```

### Home vs Dashboard

- **Home is transaction-first**: recent transactions, date/period navigation, quick add,
  wallet/account context, lightweight daily summaries.
- **Dashboard is analytics-first**: income, expenses, net cash flow, trends, category analysis,
  budgets, goals, net worth.

Don't rebuild the Dashboard on Home. Suggested Dashboard order: period/wallet context → primary
summary → cash flow → spending analysis → budgets/goals → net worth/balance → insights → recent
activity.

### Charts answer a question

Before adding one, name the question it answers ("Am I spending more than I earn?", "Where did my
money go?", "Am I within budget?"). No question, no chart. Use the simplest form that answers it:

| Purpose | Chart |
|---|---|
| Trend over time, balance history | Line |
| Category comparison, budget vs actual | Bar |
| Composition | Donut (≤ ~6 slices, rest grouped as "Other") |
| Budget progress | Progress bar |
| Income vs expense | Line or grouped bar |
| Daily spending intensity | Calendar heatmap |
| Balance movement | Waterfall |

Category colors are grouped by meaning, not rainbow-cycled.

### Insights and scores

Insights are descriptive and computed from real data — "Food ₫2,430,000, ↑ 18% vs August" — never
"You're doing great!". Never invent an insight to fill space. No score ("Financial health 87/100")
without a defined, consistent, explained methodology; prefer showing the underlying metrics.

### Refine before replacing

When modifying an existing screen, preserve its interaction patterns, navigation, terminology and
useful components. Improve hierarchy before swapping components, and never introduce a new visual
language for one screen.

---

## Part 2 — Screen & State Architecture

### The shell always renders

**A loading/error/empty state is content *within* a screen, never a replacement for the screen.**
Every screen has a **shell** (header, nav context, persistent controls) and a **content area**.
Loading, error, and empty are content-area variants — the shell always renders:

```tsx
return (
  <AnimatedScreen>
    <WalletContextBar onManage={onManage}>
      <Header />
      <Controls />                          {/* month selector, filters — always visible */}

      {isLoading ? <SkeletonList /> :
       isError   ? <StateView variant="error" error={error} retryAction={refetch} /> :
       isEmpty   ? <StateView variant="empty" ... /> :
                   <Content data={data} />}
    </WalletContextBar>
  </AnimatedScreen>
);
```

Wrapping an early return in a bare `<View>` does **not** satisfy this — the state must live inside
the real screen structure, not just inside another container. The user must always be able to
answer "where am I?" and "what can I still do?"; a state that removes the header or nav traps them.

### Scope to the smallest boundary that's true

Use the smallest scope that accurately represents the failure — most failures are Level 1 or 2:

| Level | Scope | Example |
|---|---|---|
| 1 — Inline | One component/operation | "Couldn't load transactions" + Retry, inside the list |
| 2 — Section | One section, rest of screen fine | Chart section errors; header/summary/nav unaffected |
| 3 — Screen | Screen truly can't render anything meaningful | Still keep header, nav, screen title if at all possible |
| 4 — Full-screen blocking | App-level failure (corrupt local storage, fatal auth) | Should be rare |

A failed chart request must not make the whole report screen disappear; if a goal's contributions
fail to load but the goal itself did, only the contributions section shows the inline error.

### Distinguish state types — they are not interchangeable

| State | Meaning | Tone |
|---|---|---|
| Empty | No data yet — normal | Neutral |
| Loading | Fetching — be patient | Neutral |
| Network failure | Can't reach the server, may be temporary | Warning |
| Server error | Server returned an error | Error |
| Offline | No connectivity, local data may still be available | Informational |
| Permission denied | User lacks access | Warning |
| Auth required | Session expired | Warning |

Never style a normal empty state in error red. Never use one generic message for every failure
type — an empty list and a failed load read completely differently and need different copy.

### Local-first resilience

The app has local/cached data. **A network or API failure must never become a full-screen error**
if local data can still be shown: normal shell + cached data + a small inline sync-failure banner +
retry — never a full-screen replacement. Network is an enhancement here, not a prerequisite.

### Loading preserves the final layout

Use shaped skeletons (`SkeletonList`, `Skeleton`) that match the real content's row count and
height, not a generic centered spinner — a shaped skeleton signals structure, a spinner hides it.
Skeleton only the region that is actually loading, not the whole screen, and never let content
jump when it arrives. A refetch over data already on screen keeps the data visible and shows a
small refresh indicator instead of dropping back to skeletons.

### Empty states are useful, not decorative

Name the specific situation, say in one sentence what the space is for, and offer a verb CTA. No
celebration, no apology, no generic "Nothing here yet."

```text
✗ ✨ You're ready to start your financial journey!

✓ No transactions in September
  Add one to start tracking where your money goes.
  [ Add transaction ]
```

### Recovery actions — every recoverable state needs one

| Situation | Action |
|---|---|
| Temporary API failure | Retry |
| Network unavailable | Retry / Continue Offline |
| Auth expired | Sign In |
| Permission denied | Go to Settings / Request Permission |
| Failed save/sync | Retry Save / Retry Sync |
| Missing resource | Go Back / Return Home |
| Rate limited | Try Again Later (with auto-retry timer) |

Don't show `Retry` when retrying can't possibly help (permission denied, resource deleted) — and
never show an error with no next step at all.

### Reuse the design system — don't invent a new visual language for errors

State UI uses the same tokens as everything else: `theme.colors.*`, `theme.spacing.*`,
`theme.radius.*`, `Text`/`Button`/`Card`/`StateView`, `lucide-react-native` icons,
`AnimatedScreen`/`WalletContextBar` as the shell. It should read as a normal part of the screen,
not a bolted-on error page.

### Before implementing any state UI, answer

1. What exactly failed — one call, all data, auth?
2. Scoped or global — one section or the whole screen?
3. What can still render — header, cached data, other sections?
4. Is stale/cached data available to show with a refresh indicator?
5. Can the user still navigate/interact with unaffected parts?
6. Smallest appropriate scope — inline, section, or screen?
7. Correct recovery action?
8. Can `StateView` handle this before reaching for something custom?

---

## Part 3 — Visual & Interaction Rules

### Spacing and density

- Fixed scale only — `theme.spacing` (`xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 24, `xxl` 32). An
  arbitrary 13px or 22px reads as unintentional.
- Proximity encodes grouping: related elements get a tight gap, unrelated groups a larger one —
  before any divider does.
- `paddingHorizontal > paddingVertical`, and `paddingVertical <= fontSize` (15px font → 10–12px
  vertical, 20–24px horizontal).
- Finance screens are **dense enough to scan**: strong alignment, consistent columns, compact
  metadata, small secondary labels. Whitespace is for separating groups, not for looking premium.
- When space is tight, collapse or drop secondary information (analytics, then decoration) rather
  than shrinking everything until it's hard to read.

### Radius

- Use the `theme.radius` scale; one or two radii per screen, not several competing.
- Rounded: buttons, inputs, dropdowns, pills, modal/sheet surfaces, selected controls, summary cards.
  Not rounded: individual list rows, nested containers inside containers.
- Nested corner radius: `inner = outer − outer padding` (20px outer, 8px padding → 12px inner),
  floored at 0 — keeps shapes concentric.
- A single-sided border accent (left border only) gets `radius: 0`; rounded corners only look right
  with borders on all sides.

### Borders

- Default hairline: 0.5–1px, low-contrast (`theme.colors.border`), for structural dividers.
- 2px borders mean exactly one thing per screen (selection / focus / featured) — if every card has
  a heavy border, none of them stand out.
- Border *or* shadow to separate a surface, rarely both.

### Shadows

- Shadow = elevation signal, not decoration. Flat in-flow cards need none — a hairline border does
  the job.
- Bigger blur/spread = further off the page; reserve for modals, sheets, dropdowns, popovers.
- Two-layer shadows (tight contact + soft diffuse) read more natural than one large blur.
- At most two floating elevation levels on screen at once — a third means you need a modal instead.

### Color

- Color communicates meaning before decoration. Semantic tokens are fixed: `income`, `expense`,
  `transfer`, `warning`, `danger`, `success`, `primary` (selected/accent), each with a `*Muted`
  background companion.
- Status colors (`info`, `success`, `warning`, `danger`) and flow colors (`income`, `expense`,
  `transfer`) are defined once in `STATUS_COLORS` / `FLOW_COLORS` (`mobile/src/design-system/colors.ts`):
  one hex per mode, identical in every palette. Never `primary` for info, which changes with the palette.
- Text on a filled color uses its `on*` token (`onPrimary`, `onDanger`), never a literal.
- `text` > `textMuted` > `textFaint` is a hierarchy of readable text; all three hold 4.5:1 on every
  neutral surface. `textFaint` is for placeholders, captions and empty states — not a way to fake a
  disabled look.
- Every foreground/background pair a control renders is listed in `RENDERED_PAIRS`
  (`colors.test.ts`) and must hold 4.5:1 for text, 3:1 for borders and icons, in every palette and
  mode. A new pair (a new chip, a new button variant) gets added there with the change.
- ~90% of the UI is neutral; one accent (`primary`) for primary actions. A second bright color must
  encode a *different* meaning, never visual variety.
- No raw literals (`#FF0000`) in components — tokens only (MB-06).
- Text on a colored background uses a darker/lighter stop of the *same* family, never plain
  black/gray. Title + subtitle on a colored chip use two different stops, not the same one twice.
- Text contrast ≥ 4.5:1 for body, ≥ 3:1 for large text and icons conveying state — in both themes.

### Cards

Cards are for distinct summaries, budgets, goals, independent analytical modules and standalone
interactive components — not for transactions, categories, simple label/value pairs, navigation,
or items that naturally share a section. Don't turn a list into floating cards.

One focal point per card; identical internal padding and radius across a set regardless of content
length (ragged padding is the most common "amateur" tell). A featured card gets a 2px accent border
+ a small badge on the *same* background as its siblings — changing the background too is
double-signaling.

### Lists

Dense/data-heavy lists (transactions, accounts): full-width rows with hairline dividers, no
rounded-card wrapper. Sparse/browsable lists (menus, settings): more padding, no border —
whitespace is the separator. Long lists use `FlatList`/`SectionList`, never `.map()` in a
`ScrollView`.

### Icons

`lucide-react-native` only (MB-05), one size and stroke weight per context. Use icons for
navigation, important actions, recognizable categories, status and controls — not on every line.
"Icon + title + badge + card + subtitle" is almost always worse than a two-line text row. An
icon-only control has an `accessibilityLabel`.

### Touch targets and accessibility

- Minimum hit area 44×44pt; use `hitSlop` to reach it on small icons rather than enlarging them.
- Every interactive element has an `accessibilityRole` and a label; stable selectors use `testID`
  per CLAUDE.md NC-04.
- Text scales with the system font size — don't clip or fix heights around text.
- Respect Reduce Motion (`AccessibilityInfo.isReduceMotionEnabled`): replace slides with fades or
  nothing.

### Button states — offsets on one ramp, not independent picks

| State | Rule | Example (base `blue-600`) |
|---|---|---|
| Default | base color | `blue-600` |
| Hover (web only) | 1 step darker (light) / lighter (dark) | `blue-700` |
| Pressed | 2 steps darker + optional `scale(0.98)` | `blue-800` |
| Focus | unchanged fill + added ring | `blue-600` + ring |
| Disabled | desaturate to gray, never opacity-only | `gray-200` bg / `gray-400` text |
| Loading | freeze resting color, swap only label/icon for spinner | `blue-600` unchanged |

Hover/pressed move *away* from the background (which is why direction flips between themes). Focus
never touches fill, or it becomes indistinguishable from hover. Prefer an enabled button with an
inline validation error over a disabled button with no explanation. Pressed state is tracked with
local state, never a function `style` (CLAUDE.md Part 7 rule 15).

### Selection / highlight

Change more than one property together (border weight/color + background tint + icon color) — a
single subtle cue is easy to miss. Keep unselected states quiet so selection pops by contrast.

### Search

Looks tappable at rest (border or subtle fill), not just on focus. Leading magnifying-glass icon +
trailing clear icon (shown only with input), both anchored — not placeholder text alone.

### Content / microcopy

- Sentence case everywhere; title case only for proper nouns.
- No terminal punctuation on labels/headings; helper text and empty-state body copy do end in one.
- Actions are verb-first, active voice, 1–3 words: "Delete account," not "Account deletion."
- Errors: what happened, then what to do, one sentence, no "Error:" prefix, no first person, never
  raw exception text. E.g. "That name's already taken. Try another."
- Placeholders show a realistic example value — not a repeat of the label, no "e.g." prefix.
- "Your" for the user's things, never "My." Confirmations are past tense or absent ("Saved").
- Cut filler: "please," "simply," "just," "successfully," "seamless," "leverage."
- Every string goes through i18n with `en` and `vi` kept in parity (MB-09); leave room for
  Vietnamese copy running ~30% longer than English.

### Feedback hierarchy — match the tier to the stakes

1. Inline/micro (button state, icon swap) — reversible, low-stakes.
2. Toast/snackbar (temporary, non-blocking) — confirms without demanding attention.
3. Modal/dialog (blocking, requires acknowledgment) — irreversible or high-consequence.

Tier 3 for a tier 1 action feels heavy-handed; tier 1 for a tier 3 action feels reckless.

### Success feedback and timing

| Scenario | Where it shows | Duration |
|---|---|---|
| Low-stakes, same screen | In the button itself | Checkmark 1.5–2s, then reverts |
| Higher-stakes, same screen (submit form) | Button + toast | Button 1.5–2s, toast 4–8s |
| Navigates away (create-and-view) | Brief in-button success, then navigate | 600–900ms |
| Destructive/irreversible (delete wallet) | Blocking confirmation, no micro-animation | N/A |

Never auto-revert a success state in under ~500ms (reads as a glitch). Leave the form populated
after an update; clear fields only after a create.

### Toasts

Informational: 4–5s. With an action ("Undo"): 6–8s. Errors stay until dismissed. Multiple toasts
queue, never replace one mid-animation. One consistent position app-wide.

### Motion

Motion communicates state change, movement, hierarchy or feedback — never decoration, continuous
motion, or bounce. Duration scales with the size of the change: small (checkbox, icon swap)
100–200ms; larger (panel slide, sheet) 250–400ms — past ~400ms it feels sluggish. Entering:
ease-out. Exiting: ease-in. Animation never blocks or delays an action.

### Form validation

Validate on blur for the first pass — live validation while still typing feels punitive. Switch to
live validation after a field has been validated once, so corrections get instant feedback. Errors
are text below the field, never color alone, and clear as soon as the user starts correcting.
Rules come from the `@sora/contracts` Zod schema (MB-03), never authored in the app.

### Consistency

Typography, spacing, radius, icon treatment, semantic colors and the behavior of buttons, inputs,
modals, sheets, errors and loading are shared across the app. Polish is consistent repetition of a
few decisions, not a larger number of decisions.

---

## Part 4 — Pre-completion Check

Before calling any UI change done:

- [ ] Every element has a purpose; no decoration-only cards, gradients, icons or badges
- [ ] Typography, not containers, carries the hierarchy; one or two sections are primary
- [ ] Every financial number is labelled with what it aggregates
- [ ] Income, expense, transfer and balance are distinguishable without color
- [ ] Amounts go through `<Money>` (or `formatMoneyString`), are right-aligned, tabular, per currency
- [ ] Home stays transaction-first; Dashboard stays analytics-first; nothing duplicated
- [ ] Every chart answers a named question; no invented insights or scores
- [ ] Loading, empty, error and offline states exist, inside the shell, at the smallest scope
- [ ] Every recoverable error has a working recovery action
- [ ] Spacing and radius come from the token scales; colors from semantic tokens
- [ ] Touch targets ≥ 44pt; labels/roles/`testID`s set; checked in dark and light themes
- [ ] Copy follows the microcopy rules and exists in both `en` and `vi`
- [ ] Motion is functional, ≤ 400ms, and respects Reduce Motion
