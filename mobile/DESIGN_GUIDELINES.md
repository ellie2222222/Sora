# Mobile Design Guidelines

> Every screen, component, and state in `mobile/` follows these. Part 1 is architecture (how a
> screen behaves when data is loading, missing, or broken); Part 2 is the visual/interaction
> vocabulary (spacing, color, motion, copy). Defaults, not laws — override when the specific
> screen's context genuinely calls for it, and say why in a comment if the override isn't obvious.

---

## Part 1 — Screen & State Architecture

### Core principle

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
type — "No transactions yet. Add your first to get started." reads completely differently from
"Couldn't load transactions. Something went wrong."

### Local-first resilience

The app has local/cached data. **A network or API failure must never become a full-screen error**
if local data can still be shown: normal shell + cached data + a small inline sync-failure banner +
retry — never a full-screen replacement. Network is an enhancement here, not a prerequisite.

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
not a bolted-on error page. (See Part 2 for the actual token values.)

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

## Part 2 — Visual & Interaction Rules of Thumb

### Spacing and geometry

- Nested corner radius: `inner = outer − outer padding`. 20px outer radius with 8px padding →
  12px inner radius — keeps shapes concentric. Floor at 0, never negative.
- Fixed spacing scale only: 4, 8, 12, 16, 24, 32. An arbitrary 13px or 22px reads as unintentional.
- `paddingHorizontal > paddingVertical`, and `paddingVertical <= fontSize` (15px font → 10–12px
  vertical, 20–24px horizontal).
- Proximity encodes grouping: related elements get a tight gap, unrelated groups get a larger one
  — before any divider does.
- Card internal padding is identical across every card in a set regardless of content length.
  Ragged padding is the most common "amateur" tell.

### Borders

- Default hairline: 0.5–1px, low-contrast, for structural dividers.
- 2px borders mean exactly one thing per screen (selection / focus / featured) — if every card has
  a heavy border, none of them stand out.
- Border *or* shadow to separate a surface, rarely both.
- No rounded corners on a single-sided border accent (`border-left` only) — `border-radius: 0`
  there; rounded corners only look right with borders on all sides.

### Shadows

- Shadow = elevation signal, not decoration. Flat in-flow cards typically need none — a hairline
  border does the job.
- Bigger blur/spread = further off the page; reserve for modals, dropdowns, popovers.
- Two-layer shadows (tight contact + soft diffuse) read more natural than one large blur.
- At most two floating elevation levels on screen at once — a third means you need a modal instead.

### Color

- 60/30/10: 60% primary/neutral background, 30% surface/secondary text, 10% accent (CTAs,
  highlights).
- Curated palettes only — no raw `#FF0000`/`#0000FF`. HSL-tailored ramps or a considered dark mode.
- One accent color for primary actions; a second bright color must encode a *different* meaning
  (danger, success), never just visual variety.
- Text on a colored background uses a darker shade from the *same* family, never plain black/gray.
- Title + subtitle on a colored chip: two different stops of the same ramp (e.g. 800/600), not the
  same stop twice — same stop for both reads flat.
- Gray carries most of the UI — ~90% neutral, color used sparingly and deliberately.
- Group diagram/category colors by meaning, not by sequence (don't rainbow-cycle).

### Button states — offsets on one ramp, not independent picks

| State | Rule | Example (base `blue-600`) |
|---|---|---|
| Default | base color | `blue-600` |
| Hover | 1 step darker (light) / lighter (dark) | `blue-700` |
| Active/pressed | 2 steps darker + optional `scale(0.98)` | `blue-800` |
| Focus | unchanged fill + added ring | `blue-600` + ring |
| Disabled | desaturate to gray, never opacity-only | `gray-200` bg / `gray-400` text |
| Loading | freeze resting color, swap only label/icon for spinner | `blue-600` unchanged |

Hover moves *away* from the background (this is why it flips between light/dark mode). Focus never
touches fill color, or it becomes indistinguishable from hover and breaks keyboard-a11y testing.
Prefer an enabled button with an inline validation error over a disabled button with no
explanation.

### Selection / highlight

Change more than one property together (border weight/color + background tint + icon color) — a
single subtle cue is easy to miss. Keep unselected states quiet so selection pops by contrast.

### Cards

One clear focal point per card. Consistent padding/radius across the set. A featured card gets a
2px accent border + a small badge on the *same* background as its siblings — changing the
background too is double-signaling, not extra emphasis.

### Lists

Dense/data-heavy lists: bordered rows, no rounded-card wrapper (wastes vertical space at length).
Sparse/browsable lists (menus, settings): more padding, no border — whitespace is the separator.

### Search

Looks tappable at rest (border or subtle fill), not just on focus. Leading magnifying-glass icon +
trailing clear icon (shown only with input), both anchored — not placeholder text alone.

### Content / microcopy

- Sentence case everywhere; title case only for proper nouns.
- No terminal punctuation on labels/headings; helper text and empty-state body copy do end in one.
- Verb-first, active voice, 1–3 words, no punctuation: "Delete project," not "Project deletion."
- Errors: what happened, then what to do, one sentence, no "Error:" prefix, no first person, never
  raw exception text. E.g. "That name's already taken. Try another."
- Empty states are an invitation, not an apology: headline names the space, one-line body explains
  it, CTA is a verb. Avoid "Nothing here yet."
- Placeholders show a realistic example value — not a repeat of the label, no "e.g." prefix.
- "Your" for the user's things, never "My." Confirmations: past tense or none ("Saved," not "I
  saved it") — first-person "I" is reserved for chat voice, never system UI.
- Cut filler: "please," "simply," "just," "successfully," "seamless," "leverage."

### Success feedback and timing

| Scenario | Where it shows | Duration |
|---|---|---|
| Low-stakes, same page (add to cart, follow) | In the button itself | Checkmark 1.5–2s, then reverts |
| Higher-stakes, same page (submit form) | Button + toast/banner | Button 1.5–2s, toast 4–8s |
| Navigates away (checkout, create-and-view) | Brief in-button success, then redirect | 600–900ms, then navigate |
| Destructive/irreversible (delete account) | No micro-animation — blocking confirmation | N/A |

Never auto-revert a success state in under ~500ms (reads as a glitch). Cap the *success* checkmark
at ~2s even if the network call ran longer. Leave the form populated after an update (clear fields
only after a create). Don't rely on a button flash as the only feedback for anything non-trivial.

### Toasts

Informational: 4–5s. With an action ("Undo"): 6–8s. Errors stay until dismissed. Multiple toasts
queue vertically, never replace one mid-animation. Keep position consistent app-wide.

### Motion

Duration scales with the size of the change: small (checkbox, icon swap) 100–200ms; larger (panel
slide, card expand) 250–400ms — past ~400ms a UI transition starts to feel sluggish. Entering:
ease-out (decelerate in). Exiting: ease-in (accelerate away). Don't sync the timing of two
unrelated simultaneous animations — it reads as one glitchy event instead of two intentional ones.

### Form validation

Validate on blur for the first pass — live validation while still typing feels punitive. Switch to
live validation only after a field has passed once, so corrections get instant feedback. Errors are
text below the field, never color alone. Clear the error the moment the user starts correcting it.

### Loading content

Shaped skeleton loaders (matching the real content's line count/card size), not a generic centered
spinner — a shaped skeleton signals structure, a spinner hides it.

### Feedback hierarchy — match the tier to the stakes

1. Inline/micro (button state, icon swap) — reversible, low-stakes.
2. Toast/snackbar (temporary, non-blocking) — confirms without demanding attention.
3. Modal/dialog (blocking, requires acknowledgment) — irreversible or high-consequence.

Tier 3 for a tier 1 action feels heavy-handed; tier 1 for a tier 3 action feels reckless. Most
"this feels off" complaints trace back to a tier mismatch.

### The common thread

Pick a numeric scale (spacing, radius, timing) and a small color/border vocabulary once, then apply
it with discipline everywhere. Polish is consistent repetition of a few decisions, not a larger
number of decisions.
